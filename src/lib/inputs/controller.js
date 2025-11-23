/**
 * Input Controller
 *
 * Coordinates input devices, inputs, triggers, and CSS updates.
 */

import { InputDeviceManager } from './manager.js';
import { isButtonInput } from './utils.js';
import { toCSSIdentifier } from '../css/utils.js';

export class InputController {
	constructor(inputLibrary, customPropertyManager, triggerManager) {
		this.inputDeviceManager = new InputDeviceManager();
		this.inputLibrary = inputLibrary;
		this.customPropertyManager = customPropertyManager;
		this.triggerManager = triggerManager;

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

		// Initialize pressure properties to 0% for all inputs
		this._initializePressureProperties();

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
		// Special handling for Thingy:52 (Bluetooth) devices
		if (device.type === 'bluetooth') {
			this._setupThingyListeners(device);
			return;
		}

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
	 * Setup listeners for Thingy:52 devices
	 * These expose multiple CSS properties and button as inputs
	 */
	_setupThingyListeners(device) {
		// Handle button triggers (just like other buttons)
		device.on('trigger', ({ controlId, velocity }) => {
			this._handleTrigger(device.id, controlId, velocity);
		});

		// Handle button releases
		device.on('release', ({ controlId }) => {
			this._handleRelease(device.id, controlId);
		});

		// Handle all sensor value changes and expose as CSS properties
		device.on('change', ({ controlId, value, control }) => {
			// Convert sensor control ID to CSS property name
			// e.g., "euler-roll" -> "--thingy-euler-roll"
			const propertyName = `thingy-${controlId}`;

			// Convert normalized value (0-1) to percentage or degrees based on sensor type
			let propertyValue;

			// Pan and Tilt (gravity-compensated)
			if (controlId === 'pan') {
				// Pan: Convert 0-1 back to -180 to 180 degrees
				const degrees = (value * 360) - 180;
				propertyValue = `${degrees.toFixed(1)}deg`;
			}
			else if (controlId === 'tilt') {
				// Tilt: Convert 0-1 back to -90 to 90 degrees
				const degrees = (value * 180) - 90;
				propertyValue = `${degrees.toFixed(1)}deg`;
			}
			// Euler angles are in degrees (-180 to 180)
			else if (controlId.startsWith('euler-')) {
				// Convert 0-1 back to -180 to 180 degrees
				const degrees = (value * 360) - 180;
				propertyValue = `${degrees.toFixed(1)}deg`;
			}
			// Quaternion components
			else if (controlId.startsWith('quat-')) {
				// Convert 0-1 back to -1 to 1
				const qValue = (value * 2) - 1;
				propertyValue = qValue.toFixed(3);
			}
			// Accelerometer (in g)
			else if (controlId.startsWith('accel-')) {
				// Convert 0-1 back to -4 to 4 g
				const gValue = (value * 8) - 4;
				propertyValue = `${gValue.toFixed(2)}g`;
			}
			// Gyroscope (in deg/s)
			else if (controlId.startsWith('gyro-')) {
				// Convert 0-1 back to -2000 to 2000 deg/s
				const degPerSec = (value * 4000) - 2000;
				propertyValue = `${degPerSec.toFixed(0)}deg`;
			}
			// Compass (in µT)
			else if (controlId.startsWith('compass-')) {
				// Convert 0-1 back to -100 to 100 µT
				const microTesla = (value * 200) - 100;
				propertyValue = `${microTesla.toFixed(1)}`;
			}
			// Default: use percentage
			else {
				const percentage = Math.round(value * 100);
				propertyValue = `${percentage}%`;
			}

			this.customPropertyManager.setProperty(propertyName, propertyValue);
		});

		// Auto-create a button Input for the Thingy
		// Check if input already exists
		const existingInput = this.inputLibrary.findByDeviceControl(device.id, 'button');

		if (!existingInput) {
			// Create button input
			this.inputLibrary.create({
				name: `${device.name} Button`,
				inputDeviceId: device.id,
				inputControlId: 'button',
				inputDeviceName: device.name,
				type: 'button',
				supportsColor: true,
				friendlyName: null,
				buttonMode: 'momentary', // Default to momentary, user can change to toggle
				color: null // Color can be set to control the Thingy LED
			});
		} else {
			// If input exists with a color, set the LED
			if (existingInput.color) {
				device.thingyDevice.setDeviceColor(existingInput.color);
			}
		}
	}	/**
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
		// Find the input for this control
		const input = this.inputLibrary.findByDeviceControl(deviceId, controlId);

		// Handle input CSS classes and properties
		if (input) {
			if (isButtonInput(input)) {
				// Handle toggle vs momentary mode
				const buttonMode = input.buttonMode || 'momentary';

				if (buttonMode === 'toggle') {
					// Toggle mode: flip state on each press
					const toggleKey = `${deviceId}:${controlId}`;
					const currentState = this.toggleStates.get(toggleKey) || false;
					const newState = !currentState;
					this.toggleStates.set(toggleKey, newState);

					// Apply on/off classes based on new state
					const onClass = input.cssClassOn;
					const offClass = input.cssClassOff;

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
					this._emit('input-trigger', { mapping: input, velocity, toggleState: newState });
				} else {
					// Momentary mode: add down class, remove up class
					const downClass = input.cssClassDown;
					const upClass = input.cssClassUp;

					if (downClass) this.triggerManager.addRawClass(downClass);
					if (upClass) this.triggerManager.removeRawClass(upClass);

					// Emit event for momentary button press
					this._emit('input-trigger', { mapping: input, velocity });
				}

				// Set velocity as custom property (for velocity-sensitive buttons)
				if (input.name) {
					// Velocity is already normalized to 0-1 by input devices
					const normalizedVelocity = Math.max(0, Math.min(1, velocity));
					const percentage = (normalizedVelocity * 100).toFixed(1);
					this.customPropertyManager.setProperty(`${toCSSIdentifier(input.name)}-pressure`, `${percentage}%`);
				}
			}
		}

		// Find and execute triggers for this input
		// Note: The TriggerManager will handle trigger execution based on CSS classes
		// So we don't need to manually trigger them here - they are handled by the CSS system
	}

	/**
	 * Handle release event (button/note release)
	 */
	_handleRelease(deviceId, controlId) {
		// Find the input for this control
		const input = this.inputLibrary.findByDeviceControl(deviceId, controlId);

		// Handle input CSS classes and properties
		if (input && isButtonInput(input)) {
			// Handle toggle vs momentary mode
			const buttonMode = input.buttonMode || 'momentary';

			if (buttonMode === 'momentary') {
				// Momentary mode: remove down class and add up class on release
				const downClass = input.cssClassDown;
				const upClass = input.cssClassUp;

				if (downClass) this.triggerManager.removeRawClass(downClass);
				if (upClass) this.triggerManager.addRawClass(upClass);

				// Emit event for momentary button release
				this._emit('input-release', { mapping: input });
			}
			// Toggle mode: do nothing on release (state was toggled on press)

			// Reset pressure custom property to 0%
			if (input.name) {
				this.customPropertyManager.setProperty(`${toCSSIdentifier(input.name)}-pressure`, '0.0%');
			}
		}

		// Trigger releases are handled by the CSS system via TriggerManager
	}

	/**
	 * Handle value change (knob/slider)
	 */
	_handleValueChange(deviceId, controlId, value) {
		// Find the input for this control
		const input = this.inputLibrary.findByDeviceControl(deviceId, controlId);

		// Set a custom property based on the input name (for use in CSS)
		if (input && input.name) {
			// Convert value (0-1) to percentage
			const percentage = Math.round(value * 100);
			this.customPropertyManager.setProperty(toCSSIdentifier(input.name), `${percentage}%`);

			// Emit event for input value change
			this._emit('input-valuechange', { mapping: input, value });
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
	 * Request Thingy:52 device
	 */
	async requestThingy52() {
		return await this.inputDeviceManager.requestThingy52();
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
	 * Set color on an input device control (generic for all device types)
	 * @param {string} deviceId - Device ID
	 * @param {string} controlId - Control ID (e.g., "note-36", "button-0")
	 * @param {string} color - Palette color name
	 */
	async setButtonColor(deviceId, controlId, color) {
		const device = this.inputDeviceManager.getDevice(deviceId);
		if (device && device.setColor) {
			await device.setColor(controlId, color);
		}
	}

	/**
	 * Set button color by input ID
	 * @param {string} inputId - Input ID
	 * @param {string} color - Palette color name
	 */
	async setButtonColorByInput(inputId, color) {
		const input = this.inputLibrary.get(inputId);
		if (input && input.inputDeviceId && input.inputControlId) {
			await this.setButtonColor(input.inputDeviceId, input.inputControlId, color);
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
	 * Initialize pressure custom properties for all inputs
	 * Sets all pressure properties to 0% as default
	 */
	_initializePressureProperties() {
		const inputs = this.inputLibrary.getAll();

		for (const input of inputs) {
			if (input.name && isButtonInput(input)) {
				// Initialize to 0%
				this.customPropertyManager.setProperty(`${toCSSIdentifier(input.name)}-pressure`, '0.0%');
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
