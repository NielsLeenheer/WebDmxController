/**
 * Input System
 *
 * Manages physical input controls (buttons, sliders, knobs) from MIDI/HID devices
 */

import { toCSSIdentifier } from './css/utils.js';

/**
 * Represents a configured input control
 */
export class Input {
	constructor(config = {}) {
		this.id = config.id || `input-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		this.name = config.name || 'Untitled Input';
		this.version = config.version || 0; // Version counter for reactivity

		// Input source
		this.inputDeviceId = config.inputDeviceId || null;
		this.inputControlId = config.inputControlId || null;
		this.inputDeviceName = config.inputDeviceName || null; // Store device name for display

		// Visual color for the input (shown in UI and on hardware)
		this.color = config.color;

		// Button mode for button inputs: 'momentary' or 'toggle'
		// Momentary: down/up states, Toggle: on/off states
		this.buttonMode = config.buttonMode || 'momentary';

		// Stored CSS identifiers (generated from name and stored)
		// For button inputs:
		if (this.isButtonInput()) {
			if (this.buttonMode === 'toggle') {
				// Toggle mode: on/off class names
				this.cssClassOn = config.cssClassOn || `${toCSSIdentifier(this.name)}-on`;
				this.cssClassOff = config.cssClassOff || `${toCSSIdentifier(this.name)}-off`;
				this.cssClassDown = null;
				this.cssClassUp = null;
			} else {
				// Momentary mode: down/up class names (default)
				this.cssClassDown = config.cssClassDown || `${toCSSIdentifier(this.name)}-down`;
				this.cssClassUp = config.cssClassUp || `${toCSSIdentifier(this.name)}-up`;
				this.cssClassOn = null;
				this.cssClassOff = null;
			}
			this.cssProperty = null;
		} else {
			// For slider/knob inputs: store the CSS custom property name
			this.cssProperty = config.cssProperty || `--${toCSSIdentifier(this.name)}`;
			this.cssClassDown = null;
			this.cssClassUp = null;
			this.cssClassOn = null;
			this.cssClassOff = null;
		}
	}

	/**
	 * Update stored CSS identifiers when name changes
	 */
	updateCSSIdentifiers() {
		if (this.isButtonInput()) {
			if (this.buttonMode === 'toggle') {
				this.cssClassOn = `${toCSSIdentifier(this.name)}-on`;
				this.cssClassOff = `${toCSSIdentifier(this.name)}-off`;
				this.cssClassDown = null;
				this.cssClassUp = null;
			} else {
				this.cssClassDown = `${toCSSIdentifier(this.name)}-down`;
				this.cssClassUp = `${toCSSIdentifier(this.name)}-up`;
				this.cssClassOn = null;
				this.cssClassOff = null;
			}
			this.cssProperty = null;
		} else {
			// Slider/knob inputs
			this.cssProperty = `--${toCSSIdentifier(this.name)}`;
			this.cssClassDown = null;
			this.cssClassUp = null;
			this.cssClassOn = null;
			this.cssClassOff = null;
		}
	}

	/**
	 * Check if this input is a button (vs slider/knob)
	 */
	isButtonInput() {
		if (!this.inputControlId) return false;
		// Button controls:
		// - MIDI notes: note-XX
		// - HID/StreamDeck buttons: button-XX or just 'button' (Thingy:52)
		// - Keyboard keys: key-XX
		// - CC/control changes are sliders/knobs
		return this.inputControlId.startsWith('note-') ||
		       this.inputControlId.startsWith('button-') ||
		       this.inputControlId === 'button' ||
		       this.inputControlId.startsWith('key-');
	}

	/**
	 * Get CSS property name for this input (for sliders/knobs)
	 */
	getInputPropertyName() {
		return this.cssProperty || `--${toCSSIdentifier(this.name)}`;
	}

	/**
	 * Serialize to JSON for storage
	 */
	toJSON() {
		return {
			id: this.id,
			name: this.name,
			version: this.version,
			inputDeviceId: this.inputDeviceId,
			inputControlId: this.inputControlId,
			inputDeviceName: this.inputDeviceName,
			color: this.color,
			buttonMode: this.buttonMode,
			cssClassOn: this.cssClassOn,
			cssClassOff: this.cssClassOff,
			cssClassDown: this.cssClassDown,
			cssClassUp: this.cssClassUp,
			cssProperty: this.cssProperty
		};
	}

	/**
	 * Deserialize from JSON
	 */
	static fromJSON(json) {
		return new Input(json);
	}
}

/**
 * Event emitter helper
 */
class EventEmitter {
	constructor() {
		this.listeners = {};
	}

	on(event, callback) {
		if (!this.listeners[event]) {
			this.listeners[event] = [];
		}
		this.listeners[event].push(callback);
	}

	off(event, callback) {
		if (!this.listeners[event]) return;
		this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
	}

	_emit(event, data) {
		if (!this.listeners[event]) return;
		this.listeners[event].forEach(callback => callback(data));
	}
}

/**
 * Manages the collection of inputs
 */
export class InputLibrary extends EventEmitter {
	constructor() {
		super();
		this.inputs = new Map();
		this.storageKey = 'webdmx-inputs';
		this.load();
	}

	/**
	 * Add a new input
	 */
	add(input) {
		this.inputs.set(input.id, input);
		this.save();
		this._emit('changed', { type: 'add', input });
		return input;
	}

	/**
	 * Get an input by ID
	 */
	get(id) {
		return this.inputs.get(id);
	}

	/**
	 * Get all inputs
	 */
	getAll() {
		return Array.from(this.inputs.values());
	}

	/**
	 * Update an existing input
	 */
	update(input) {
		if (this.inputs.has(input.id)) {
			input.version = (input.version || 0) + 1;
			this.inputs.set(input.id, input);
			this.save();
			this._emit('changed', { type: 'update', input });
		}
	}

	/**
	 * Remove an input
	 */
	remove(id) {
		const input = this.inputs.get(id);
		if (input) {
			this.inputs.delete(id);
			this.save();
			this._emit('changed', { type: 'remove', input });
		}
	}

	/**
	 * Find input by device and control ID
	 */
	findByDeviceControl(deviceId, controlId) {
		return this.getAll().find(i =>
			i.inputDeviceId === deviceId && i.inputControlId === controlId
		);
	}

	/**
	 * Reorder inputs
	 */
	reorder(newOrder) {
		this.inputs.clear();
		newOrder.forEach(input => {
			this.inputs.set(input.id, input);
		});
		this.save();
		this._emit('changed', { type: 'reorder' });
	}

	/**
	 * Save to localStorage
	 */
	save() {
		const data = Array.from(this.inputs.values()).map(input => input.toJSON());
		localStorage.setItem(this.storageKey, JSON.stringify(data));
	}

	/**
	 * Load from localStorage
	 */
	load() {
		try {
			const data = localStorage.getItem(this.storageKey);
			if (data) {
				const inputs = JSON.parse(data);
				this.inputs.clear();
				inputs.forEach(inputData => {
					const input = Input.fromJSON(inputData);
					this.inputs.set(input.id, input);
				});
			}
		} catch (error) {
			console.error('Failed to load inputs:', error);
		}
	}

	/**
	 * Clear all inputs
	 */
	clear() {
		this.inputs.clear();
		this.save();
	}
}
