/**
 * Input Controller
 *
 * Coordinates input devices, mappings, and CSS updates.
 * Handles both trigger and direct mode mappings.
 */

import { InputDeviceManager } from './inputs.js';
import { MappingLibrary, TriggerManager } from './mappings.js';
import { CustomPropertyManager } from './cssEngine.js';

export class InputController {
	constructor(mappingLibrary, customPropertyManager, triggerManager) {
		this.inputDeviceManager = new InputDeviceManager();
		this.mappingLibrary = mappingLibrary || new MappingLibrary();
		this.customPropertyManager = customPropertyManager || new CustomPropertyManager();
		this.triggerManager = triggerManager || new TriggerManager();

		this.listeners = new Map();
		this._setupInputListeners();
	}

	/**
	 * Initialize the controller
	 */
	async initialize() {
		// Initialize custom properties
		this.customPropertyManager.initialize();

		// Initialize MIDI
		await this.inputDeviceManager.initMIDI();

		// Enable keyboard by default
		this.inputDeviceManager.enableKeyboard();

		// Listen for device changes
		this.inputDeviceManager.on('deviceadded', (device) => {
			this._setupDeviceListeners(device);
			this._emit('deviceadded', device);
		});

		this.inputDeviceManager.on('deviceremoved', (device) => {
			this._emit('deviceremoved', device);
		});
	}

	/**
	 * Setup listeners for input devices
	 */
	_setupInputListeners() {
		// Will setup listeners when devices are added
	}

	/**
	 * Setup listeners for a specific device
	 */
	_setupDeviceListeners(device) {
		// Handle triggers (buttons, notes)
		device.on('trigger', ({ controlId, velocity }) => {
			this._handleTrigger(device.id, controlId, velocity);
		});

		// Handle releases (for button-hold animations)
		device.on('release', ({ controlId }) => {
			this._handleRelease(device.id, controlId);
		});

		// Handle value changes (knobs, sliders)
		device.on('change', ({ controlId, value }) => {
			this._handleValueChange(device.id, controlId, value);
		});
	}

	/**
	 * Handle trigger event (button/note press)
	 */
	_handleTrigger(deviceId, controlId, velocity) {
		// Find mappings for this input
		const mappings = this.mappingLibrary.getByInput(deviceId, controlId);

		for (const mapping of mappings) {
			if (mapping.mode === 'trigger') {
				// Trigger animation via CSS class
				this.triggerManager.trigger(mapping);
				this._emit('trigger', { mapping, velocity });
			}
		}
	}

	/**
	 * Handle release event (button/note release)
	 */
	_handleRelease(deviceId, controlId) {
		// Find mappings for this input
		const mappings = this.mappingLibrary.getByInput(deviceId, controlId);

		for (const mapping of mappings) {
			if (mapping.mode === 'trigger' && mapping.iterations === 'infinite') {
				// Release infinite animations
				this.triggerManager.release(mapping);
				this._emit('release', { mapping });
			}
		}
	}

	/**
	 * Handle value change (knob/slider)
	 */
	_handleValueChange(deviceId, controlId, value) {
		// Find mappings for this input
		const mappings = this.mappingLibrary.getByInput(deviceId, controlId);

		for (const mapping of mappings) {
			if (mapping.mode === 'direct') {
				// Update CSS custom property
				const propertyName = mapping.getPropertyName();
				const propertyValue = mapping.mapValue(value);

				this.customPropertyManager.setProperty(propertyName, propertyValue);
				this._emit('valuechange', { mapping, value, propertyValue });
			}
		}
	}

	/**
	 * Request HID device
	 */
	async requestHIDDevice(filters = []) {
		return await this.inputDeviceManager.requestHIDDevice(filters);
	}

	/**
	 * Get all input devices
	 */
	getInputDevices() {
		return this.inputDeviceManager.getAllDevices();
	}

	/**
	 * Get input device by ID
	 */
	getInputDevice(deviceId) {
		return this.inputDeviceManager.getDevice(deviceId);
	}

	/**
	 * Create virtual input device
	 */
	createVirtualDevice(name) {
		return this.inputDeviceManager.createVirtual(name);
	}

	/**
	 * Set trigger container element
	 */
	setTriggerContainer(element) {
		this.triggerManager.setContainer(element);
	}

	/**
	 * Event handling
	 */
	on(event, callback) {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, []);
		}
		this.listeners.get(event).push(callback);
	}

	off(event, callback) {
		if (!this.listeners.has(event)) return;
		const callbacks = this.listeners.get(event);
		const index = callbacks.indexOf(callback);
		if (index !== -1) {
			callbacks.splice(index, 1);
		}
	}

	_emit(event, data) {
		if (!this.listeners.has(event)) return;
		const callbacks = this.listeners.get(event);
		for (const callback of callbacks) {
			callback(data);
		}
	}

	/**
	 * Cleanup
	 */
	destroy() {
		this.inputDeviceManager.disconnectAll();
		this.customPropertyManager.destroy();
		this.triggerManager.clearAll();
		this.listeners.clear();
	}
}
