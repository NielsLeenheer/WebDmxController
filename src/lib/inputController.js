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
		this.toggleStates = new Map(); // Track toggle button states: "deviceId:controlId" -> boolean
		this._setupInputListeners();
	}

	/**
	 * Initialize the controller
	 */
	async initialize() {
		// Initialize custom properties
		this.customPropertyManager.initialize();

		// Initialize pressure properties to 0% for all input mappings
		this._initializePressureProperties();

		// Listen for mapping changes to initialize pressure for new mappings
		this.mappingLibrary.on('changed', ({ type, mapping }) => {
			if (type === 'add' && mapping.mode === 'input' && mapping.name && mapping.isButtonInput()) {
				const propertyName = mapping.name
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-')
					.replace(/^-+|-+$/g, '');
				this.customPropertyManager.setProperty(`${propertyName}-pressure`, '0.0%');
			}
		});

		// IMPORTANT: Set up device listeners BEFORE initializing devices
		// Otherwise auto-reconnected devices won't have their listeners attached
		this.inputDeviceManager.on('deviceadded', (device) => {
			this._setupDeviceListeners(device);
			this._emit('deviceadded', device);
		});

		this.inputDeviceManager.on('deviceremoved', (device) => {
			this._emit('deviceremoved', device);
		});

		// Initialize MIDI
		await this.inputDeviceManager.initMIDI();

		// Auto-reconnect Stream Deck devices
		await this.inputDeviceManager.autoReconnectStreamDecks();

		// Enable keyboard by default
		this.inputDeviceManager.enableKeyboard();
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
	 * Generate CSS class name from control ID
	 */
	_generateClassName(controlId, suffix) {
		const controlPart = controlId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
		return `${controlPart}_${suffix}`;
	}

	/**
	 * Handle trigger event (button/note press)
	 */
	_handleTrigger(deviceId, controlId, velocity) {
		// Find mappings for this input
		const mappings = this.mappingLibrary.getByInput(deviceId, controlId);

		// Only add CSS classes if this input has defined mappings
		if (mappings.length > 0) {
			// Find the input mapping (mode='input') for this control
			const inputMapping = mappings.find(m => m.mode === 'input');

			if (inputMapping && inputMapping.isButtonInput()) {
				// Handle toggle vs momentary mode
				const buttonMode = inputMapping.buttonMode || 'momentary';

				if (buttonMode === 'toggle') {
					// Toggle mode: flip state on each press
					const toggleKey = `${deviceId}:${controlId}`;
					const currentState = this.toggleStates.get(toggleKey) || false;
					const newState = !currentState;
					this.toggleStates.set(toggleKey, newState);

					// Apply on/off classes based on new state
					const onClass = inputMapping.cssClassOn;
					const offClass = inputMapping.cssClassOff;

					if (newState) {
						// Turned ON
						if (onClass) this.triggerManager.addRawClass(onClass);
						if (offClass) this.triggerManager.removeRawClass(offClass);
					} else {
						// Turned OFF
						if (offClass) this.triggerManager.addRawClass(offClass);
						if (onClass) this.triggerManager.removeRawClass(onClass);
					}

					// Emit event for toggle state change
					this._emit('input-trigger', { mapping: inputMapping, velocity, toggleState: newState });
				} else {
					// Momentary mode: add down class, remove up class
					const downClass = inputMapping.cssClassDown;
					const upClass = inputMapping.cssClassUp;

					if (downClass) this.triggerManager.addRawClass(downClass);
					if (upClass) this.triggerManager.removeRawClass(upClass);

					// Emit event for momentary button press
					this._emit('input-trigger', { mapping: inputMapping, velocity });
				}

				// Set velocity as custom property (for velocity-sensitive buttons)
				if (inputMapping.name) {
					// Generate CSS custom property name from input name
					const propertyName = inputMapping.name
						.toLowerCase()
						.replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with dashes
						.replace(/^-+|-+$/g, '');      // Remove leading/trailing dashes

					// Velocity is already normalized to 0-1 by input devices
					const normalizedVelocity = Math.max(0, Math.min(1, velocity));
					const percentage = (normalizedVelocity * 100).toFixed(1);
					this.customPropertyManager.setProperty(`${propertyName}-pressure`, `${percentage}%`);
				}
			}

			for (const mapping of mappings) {
				if (mapping.mode === 'trigger') {
					// For toggle buttons, handle trigger state differently
					if (inputMapping && inputMapping.buttonMode === 'toggle') {
						// Get current toggle state
						const toggleKey = `${deviceId}:${controlId}`;
						const isOn = this.toggleStates.get(toggleKey) || false;

						// Manually toggle the trigger CSS class
						if (isOn) {
							this.triggerManager.addRawClass(mapping.cssClassName);
						} else {
							this.triggerManager.removeRawClass(mapping.cssClassName);
						}
					} else {
						// Momentary buttons use normal trigger/release cycle
						this.triggerManager.trigger(mapping);
					}
					this._emit('trigger', { mapping, velocity });
				}
			}
		}
	}

	/**
	 * Handle release event (button/note release)
	 */
	_handleRelease(deviceId, controlId) {
		// Find mappings for this input
		const mappings = this.mappingLibrary.getByInput(deviceId, controlId);

		// Only update CSS classes if this input has defined mappings
		if (mappings.length > 0) {
			// Find the input mapping (mode='input') for this control
			const inputMapping = mappings.find(m => m.mode === 'input');

			if (inputMapping && inputMapping.isButtonInput()) {
				// Handle toggle vs momentary mode
				const buttonMode = inputMapping.buttonMode || 'momentary';

				if (buttonMode === 'momentary') {
					// Momentary mode: remove down class and add up class on release
					const downClass = inputMapping.cssClassDown;
					const upClass = inputMapping.cssClassUp;

					if (downClass) this.triggerManager.removeRawClass(downClass);
					if (upClass) this.triggerManager.addRawClass(upClass);

					// Emit event for momentary button release
					this._emit('input-release', { mapping: inputMapping });
				}
				// Toggle mode: do nothing on release (state was toggled on press)

				// Reset pressure custom property to 0%
				if (inputMapping.name) {
					const propertyName = inputMapping.name
						.toLowerCase()
						.replace(/[^a-z0-9]+/g, '-')
						.replace(/^-+|-+$/g, '');
					this.customPropertyManager.setProperty(`${propertyName}-pressure`, '0.0%');
				}
			}

			for (const mapping of mappings) {
				if (mapping.mode === 'trigger') {
					// For toggle buttons, don't call release (state was toggled on press)
					if (inputMapping && inputMapping.buttonMode === 'toggle') {
						// Toggle mode: do nothing on release for triggers
						continue;
					}

					// Always triggers don't respond to release
					if (mapping.triggerType !== 'always') {
						this.triggerManager.release(mapping);
						this._emit('release', { mapping });
					}
				}
			}
		}
	}

	/**
	 * Handle value change (knob/slider)
	 */
	_handleValueChange(deviceId, controlId, value) {
		// Find mappings for this input
		const mappings = this.mappingLibrary.getByInput(deviceId, controlId);

		// Always set a custom property based on the input name (for use in CSS)
		// Find the input mapping (mode='input') for this control
		const inputMapping = mappings.find(m => m.mode === 'input');
		if (inputMapping && inputMapping.name) {
			// Generate CSS custom property name from input name
			const propertyName = inputMapping.name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with dashes
				.replace(/^-+|-+$/g, '');      // Remove leading/trailing dashes

			// Convert value (0-1) to percentage
			const percentage = Math.round(value * 100);
			this.customPropertyManager.setProperty(propertyName, `${percentage}%`);

			// Emit event for input value change
			this._emit('input-valuechange', { mapping: inputMapping, value });
		}

		// Process direct mode mappings
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
	 * Request Stream Deck device
	 */
	async requestStreamDeck() {
		return await this.inputDeviceManager.requestStreamDeck();
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
	 * Set button color on a MIDI device
	 * @param {string} deviceId - Device ID
	 * @param {string} controlId - Control ID (e.g., "note-36")
	 * @param {string|number} color - Color name or velocity value
	 */
	setButtonColor(deviceId, controlId, color) {
		const device = this.inputDeviceManager.getDevice(deviceId);
		if (device && device.type === 'midi' && device.setButtonColor) {
			// Extract note number from control ID (e.g., "note-36" -> 36)
			const noteMatch = controlId.match(/note-(\d+)/);
			if (noteMatch) {
				const noteNumber = parseInt(noteMatch[1]);
				device.setButtonColor(noteNumber, color);
			}
		}
	}

	/**
	 * Set button color by input mapping
	 * @param {string} mappingId - Mapping ID or name
	 * @param {string|number} color - Color name or velocity value
	 */
	setButtonColorByMapping(mappingId, color) {
		const mapping = this.mappingLibrary.get(mappingId);
		if (mapping && mapping.inputDeviceId && mapping.inputControlId) {
			this.setButtonColor(mapping.inputDeviceId, mapping.inputControlId, color);
		}
	}

	/**
	 * Clear all button colors on a device
	 * @param {string} deviceId - Device ID
	 */
	clearDeviceColors(deviceId) {
		const device = this.inputDeviceManager.getDevice(deviceId);
		if (device && device.type === 'midi') {
			// Turn off all notes (0-127)
			for (let i = 0; i < 128; i++) {
				if (device.sendNoteOff) {
					device.sendNoteOff(i);
				}
			}
		}
	}

	/**
	 * Initialize pressure custom properties for all input mappings
	 * Sets all pressure properties to 0% as default
	 */
	_initializePressureProperties() {
		const allMappings = this.mappingLibrary.getAll();
		const inputMappings = allMappings.filter(m => m.mode === 'input');

		for (const mapping of inputMappings) {
			if (mapping.name && mapping.isButtonInput()) {
				// Generate CSS custom property name from input name
				const propertyName = mapping.name
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with dashes
					.replace(/^-+|-+$/g, '');      // Remove leading/trailing dashes

				// Initialize to 0%
				this.customPropertyManager.setProperty(`${propertyName}-pressure`, '0.0%');
			}
		}
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
