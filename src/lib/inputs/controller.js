/**
 * Input Controller
 *
 * Coordinates input devices, inputs, triggers, and CSS updates.
 */

import { InputDeviceManager } from './manager.js';
import { isButton } from './utils.js';
import { getInputType } from './types/index.js';

export class InputController {
	constructor(inputLibrary, customPropertyManager, triggerManager) {
		this.inputDeviceManager = new InputDeviceManager();
		this.inputLibrary = inputLibrary;
		this.customPropertyManager = customPropertyManager;
		this.triggerManager = triggerManager;

		this.listeners = new Map();
		this.toggleStates = new Map(); // Track toggle button states: "deviceId:controlId" -> boolean
		this._setupInputListeners();
		this._setupLibraryListeners();
	}

	/**
	 * Setup listeners for input library changes
	 * Syncs hardware state when inputs are added/updated/removed
	 */
	_setupLibraryListeners() {
		// When an input is added, initialize its CSS properties and update hardware colors
		this.inputLibrary.on('added', (input) => {
			if (isButton(input) && input.cssIdentifier) {
				this.customPropertyManager.setProperty(`${input.cssIdentifier}-pressure`, '0.0%');
			}
			if (input.colorSupport && input.colorSupport !== 'none') {
				this.applyColorsToDevices().catch(err => {
					console.warn('Failed to apply colors after input added:', err);
				});
			}
		});

		// When an input is updated, sync color to hardware if it changed
		this.inputLibrary.on('updated', ({ item, changes }) => {
			// Check if color was changed
			if (changes.color !== undefined && item.colorSupport && item.colorSupport !== 'none') {
				const device = this.inputDeviceManager.getDevice(item.deviceId);
				if (device && item.color) {
					const effectiveColor = this._getEffectiveButtonColor(item);
					device.setColor(item.controlId, effectiveColor).catch(err => {
						console.warn('Failed to update button color:', err);
					});

					// Special handling for Thingy LED
					if (device.type === 'thingy' && device.thingyDevice) {
						device.thingyDevice.setDeviceColor(item.color);
					}
				}
			}
		});

		// When an input is removed, update hardware to turn off the button
		this.inputLibrary.on('removed', (input) => {
			if (input.colorSupport && input.colorSupport !== 'none') {
				this.applyColorsToDevices().catch(err => {
					console.warn('Failed to apply colors after input removed:', err);
				});
			}
		});
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

			// Apply colors to the newly connected device after a small delay
			// to ensure the device is fully initialized
			setTimeout(() => {
				this.applyColorsToDevices().catch(err => {
					console.warn('Failed to apply colors on device added:', err);
				});
			}, 500);
		});

		this.inputDeviceManager.on('deviceremoved', (device) => {
			this._emit('deviceremoved', device);
		});

		// Initialize MIDI
		await this.inputDeviceManager.initMIDI();

		// Initialize Gamepad support
		this.inputDeviceManager.initGamepads();

		// Auto-reconnect Stream Deck devices
		await this.inputDeviceManager.autoReconnectStreamDecks();

		// Enable keyboard by default
		this.inputDeviceManager.enableKeyboard();

		// Apply colors to all devices after initialization
		// Use a small delay to ensure devices are fully ready
		setTimeout(() => {
			this.applyColorsToDevices().catch(err => {
				console.warn('Failed to apply colors on initial load:', err);
			});
		}, 100);
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
		// Special handling for Thingy:52 devices
		if (device.type === 'thingy') {
			this._setupThingyListeners(device);
			return;
		}

		// Gamepad devices have their events routed through the manager
		// No additional setup needed here - they use the standard trigger/change events
		if (device.type === 'gamepad') {
			// Handle triggers (buttons)
			device.on('trigger', ({ controlId, velocity }) => {
				this._handleTrigger(device.id, controlId, velocity);
			});

			// Handle releases (for button-hold animations)
			device.on('release', ({ controlId }) => {
				this._handleRelease(device.id, controlId);
			});

			// Handle value changes (axes, sticks)
			device.on('change', (eventData) => {
				const { controlId, value, x, y } = eventData;
				this._handleValueChange(device.id, controlId, value, { x, y });
			});
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

		// Handle value changes (knobs, sliders, sticks)
		device.on('change', (eventData) => {
			const { controlId, value, x, y } = eventData;
			this._handleValueChange(device.id, controlId, value, { x, y });
		});
	}

	/**
	 * Setup listeners for Thingy:52 devices
	 * A Thingy is a single input that exposes button functionality plus all sensor CSS properties
	 */
	_setupThingyListeners(device) {
		// Auto-create a single Thingy input for this device
		// Check if input already exists (use 'thingy' as controlId to represent the whole device)
		let thingyInput = this.inputLibrary.findByDeviceControl(device.id, 'thingy');

		if (!thingyInput) {
			// Create thingy input - a single input with button + all sensors
			thingyInput = this.inputLibrary.create({
				name: device.name,
				deviceId: device.id,
				controlId: 'thingy',
				deviceName: device.name,
				type: 'thingy',
				colorSupport: 'rgb',
				controlName: null,
				buttonMode: 'momentary'
			});
		}

		// Ensure thingy has a color assigned (auto-assign if missing)
		if (!thingyInput.color) {
			const color = this.inputLibrary.getNextColor(device.id, 'rgb');
			this.inputLibrary.update(thingyInput.id, { color });
			// Note: Library event will trigger hardware sync via _setupLibraryListeners
		} else if (device.thingyDevice) {
			// If input exists with a color, set the LED
			device.thingyDevice.setDeviceColor(thingyInput.color);
		}

		// Get the InputType for value conversion metadata
		const thingyType = getInputType('thingy');
		const exportedValues = thingyType.getExportedValues(thingyInput);

		// Build a lookup map from sensor key to value metadata
		const sensorMetadata = new Map();
		for (const valueDef of exportedValues) {
			sensorMetadata.set(valueDef.key, valueDef);
		}

		// Handle button triggers - the Thingy input has button functionality
		device.on('trigger', ({ controlId, velocity }) => {
			if (controlId === 'button') {
				// Route to the thingy input (use 'thingy' controlId for lookup)
				this._handleTrigger(device.id, 'thingy', velocity);
			}
		});

		// Handle button releases
		device.on('release', ({ controlId }) => {
			if (controlId === 'button') {
				this._handleRelease(device.id, 'thingy');
			}
		});

		// Handle euler angle changes for UI display (like stick x/y)
		if (device.thingyDevice) {
			device.thingyDevice.on('euler', ({ roll, pitch, yaw }) => {
				// Emit as input-valuechange for unified state tracking
				this._emit('input-valuechange', { mapping: thingyInput, roll, pitch, yaw });
			});
		}

		// Handle all sensor value changes and expose as CSS properties
		device.on('change', ({ controlId, value }) => {
			// Look up metadata for this sensor
			const metadata = sensorMetadata.get(controlId);
			if (!metadata || !metadata.cssProperty) return;

			// Convert normalized value (0-1) back to real value using metadata
			const { min, max, unit } = metadata;
			const realValue = min + (value * (max - min));

			// Format the CSS property value with appropriate precision and unit
			let propertyValue;
			if (unit === 'deg' || unit === 'deg/s') {
				propertyValue = `${realValue.toFixed(1)}deg`;
			} else if (unit === 'g') {
				propertyValue = `${realValue.toFixed(2)}g`;
			} else if (unit === 'µT') {
				propertyValue = realValue.toFixed(1);
			} else if (unit === '') {
				// Quaternion - no unit
				propertyValue = realValue.toFixed(3);
			} else {
				propertyValue = `${realValue.toFixed(1)}${unit}`;
			}

			// Extract property name from cssProperty (remove leading --)
			const propertyName = metadata.cssProperty.replace(/^--/, '');
			this.customPropertyManager.setProperty(propertyName, propertyValue);
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
		// Find the input for this control
		const input = this.inputLibrary.findByDeviceControl(deviceId, controlId);

		// Handle input CSS classes and properties
		if (input) {
			if (isButton(input)) {
				// Handle toggle vs momentary mode
				const buttonMode = input.buttonMode || 'momentary';
				const cssId = input.cssIdentifier;

				if (buttonMode === 'toggle') {
					// Toggle mode: flip state on each press
					const toggleKey = `${deviceId}:${controlId}`;
					const currentState = this.toggleStates.get(toggleKey) || false;
					const newState = !currentState;
					this.toggleStates.set(toggleKey, newState);

					// Apply on/off classes based on new state
					const onClass = `${cssId}-on`;
					const offClass = `${cssId}-off`;

					if (newState) {
						// Turned ON
						this.triggerManager.addRawClass(onClass);
						this.triggerManager.removeRawClass(offClass);
					} else {
						// Turned OFF
						this.triggerManager.addRawClass(offClass);
						this.triggerManager.removeRawClass(onClass);
					}

					// Update button color based on toggle state
					this.updateButtonColorForToggleState(input, newState);

					// Emit event for toggle state change
					this._emit('input-trigger', { mapping: input, velocity, toggleState: newState });
				} else {
					// Momentary mode: add down class, remove up class
					const downClass = `${cssId}-down`;
					const upClass = `${cssId}-up`;

					this.triggerManager.addRawClass(downClass);
					this.triggerManager.removeRawClass(upClass);

					// Emit event for momentary button press
					this._emit('input-trigger', { mapping: input, velocity });
				}

				// Set velocity as custom property (for velocity-sensitive buttons)
				if (cssId) {
					// Velocity is already normalized to 0-1 by input devices
					const normalizedVelocity = Math.max(0, Math.min(1, velocity));
					const percentage = (normalizedVelocity * 100).toFixed(1);
					this.customPropertyManager.setProperty(`${cssId}-pressure`, `${percentage}%`);
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
		if (input && isButton(input)) {
			// Handle toggle vs momentary mode
			const buttonMode = input.buttonMode || 'momentary';
			const cssId = input.cssIdentifier;

			if (buttonMode === 'momentary') {
				// Momentary mode: remove down class and add up class on release
				const downClass = `${cssId}-down`;
				const upClass = `${cssId}-up`;

				this.triggerManager.removeRawClass(downClass);
				this.triggerManager.addRawClass(upClass);
			}
			// Toggle mode: CSS classes were already toggled on press

			// Emit release event for all button types (for UI pressed state tracking)
			this._emit('input-release', { mapping: input });

			// Reset pressure custom property to 0%
			if (cssId) {
				this.customPropertyManager.setProperty(`${cssId}-pressure`, '0.0%');
			}
		}

		// Trigger releases are handled by the CSS system via TriggerManager
	}

	/**
	 * Handle value change (knob/slider/stick)
	 */
	_handleValueChange(deviceId, controlId, value, extraData = {}) {
		// Find the input for this control
		const input = this.inputLibrary.findByDeviceControl(deviceId, controlId);

		if (!input) return;

		// Set custom properties based on the input's cssIdentifier (for use in CSS)
		if (input.cssIdentifier) {
			// For stick inputs (have x and y)
			if (input.type === 'stick' && extraData.x !== undefined && extraData.y !== undefined) {
				// Convert from -1..1 to 0..100 percentage
				const xPercent = Math.round(((extraData.x + 1) / 2) * 100);
				const yPercent = Math.round(((extraData.y + 1) / 2) * 100);
				this.customPropertyManager.setProperty(`${input.cssIdentifier}-x`, `${xPercent}%`);
				this.customPropertyManager.setProperty(`${input.cssIdentifier}-y`, `${yPercent}%`);

				// Emit event for input value change with x and y
				this._emit('input-valuechange', { mapping: input, x: xPercent, y: yPercent });
			} else if (value !== undefined) {
				// For regular value inputs (knobs, sliders, axes)
				// Convert value (0-1) to percentage
				const percentage = Math.round(value * 100);
				this.customPropertyManager.setProperty(input.cssIdentifier, `${percentage}%`);

				// Emit event for input value change
				this._emit('input-valuechange', { mapping: input, value });
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
		if (input && input.deviceId && input.controlId) {
			await this.setButtonColor(input.deviceId, input.controlId, color);
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
	 * Get effective color for a button based on toggle state
	 * @param {object} input - Input object
	 * @returns {string} Color name or 'black' for off state
	 */
	_getEffectiveButtonColor(input) {
		if (!input.color) return 'black';

		// For toggle buttons, check toggle state
		if (isButton(input) && input.buttonMode === 'toggle') {
			const toggleKey = `${input.deviceId}:${input.controlId}`;
			const isOn = this.toggleStates.get(toggleKey) || false;
			return isOn ? input.color : 'black';
		}

		return input.color;
	}

	/**
	 * Update button color based on toggle state
	 * @param {object} input - Input object
	 * @param {boolean} isOn - Toggle state (on = true, off = false)
	 */
	async updateButtonColorForToggleState(input, isOn) {
		const device = this.inputDeviceManager.getDevice(input.deviceId);
		if (!device || !input.color || !input.colorSupport || input.colorSupport === 'none') return;

		const color = isOn ? input.color : 'black';
		await device.setColor(input.controlId, color);
	}

	/**
	 * Apply colors to all connected devices based on saved inputs
	 * Updates assigned controls to their colors and unassigned controls to black
	 */
	async applyColorsToDevices() {
		const devices = this.inputDeviceManager.getAllDevices();
		const inputs = this.inputLibrary.getAll();

		for (const device of devices) {
			// For MIDI devices with profiles, handle color-capable controls
			if (device.type === 'midi' && device.profile) {
				await this._applyColorsToMIDIDevice(device, inputs);
			} else if (typeof device.getControls === 'function') {
				// For devices with getControls() method (StreamDeck, etc.)
				await this._applyColorsToControlsDevice(device, inputs);
			} else {
				// For other devices (HID, Bluetooth) without getControls()
				await this._applyColorsToGenericDevice(device, inputs);
			}
		}
	}

	/**
	 * Apply colors to a MIDI device
	 * @private
	 */
	async _applyColorsToMIDIDevice(device, inputs) {
		// Build a map of assigned controls for this device
		const assignedControls = new Map();
		for (const input of inputs) {
			if (input.deviceId === device.id && input.color) {
				assignedControls.set(input.controlId, input);
			}
		}

		// Get all color-capable controls from the profile
		const colorCapableControls = device.profile.controls?.filter(
			ctrl => ctrl.colorSupport && ctrl.colorSupport !== 'none'
		) || [];

		// Check if device supports batch color updates (Akai LPD8 MK2, etc.)
		const supportsBatchUpdate = typeof device.profile.setPadColor === 'function' &&
		                           typeof device.profile.flushColors === 'function';

		if (supportsBatchUpdate && device.profile.padNotes) {
			// Batch mode: update all pad states first, then send ONE message
			for (const note of device.profile.padNotes) {
				const controlId = `note-${note}`;
				const input = assignedControls.get(controlId);
				const color = input ? this._getEffectiveButtonColor(input) : 'black';
				device.profile.setPadColor(note, color);
			}

			// Send single update with all pad colors
			const command = device.profile.flushColors();
			if (command && command.type === 'sysex' && device.midiOutput) {
				device.midiOutput.send(command.value);
			}
		} else {
			// Non-batch mode: send individual updates for all color-capable controls
			for (const control of colorCapableControls) {
				const input = assignedControls.get(control.controlId);
				const color = input ? this._getEffectiveButtonColor(input) : 'black';
				await device.setColor(control.controlId, color);
			}
		}
	}

	/**
	 * Apply colors to a device with getControls() method (StreamDeck, etc.)
	 * @private
	 */
	async _applyColorsToControlsDevice(device, inputs) {
		const controls = device.getControls();
		
		// Build a map of assigned controls for this device
		const assignedControls = new Map();
		for (const input of inputs) {
			if (input.deviceId === device.id && input.color) {
				assignedControls.set(input.controlId, input);
			}
		}

		for (const control of controls) {
			if (!control.colorSupport || control.colorSupport === 'none') continue;

			const input = assignedControls.get(control.controlId);
			const color = input ? this._getEffectiveButtonColor(input) : 'black';
			await device.setColor(control.controlId, color);
		}
	}

	/**
	 * Apply colors to a generic device without getControls()
	 * @private
	 */
	async _applyColorsToGenericDevice(device, inputs) {
		for (const input of inputs) {
			if (input.deviceId !== device.id) continue;
			if (!input.color || !input.colorSupport || input.colorSupport === 'none') continue;

			const color = this._getEffectiveButtonColor(input);
			await device.setColor(input.controlId, color);
		}
	}

	/**
	 * Initialize pressure custom properties for all inputs
	 * Sets all pressure properties to 0% as default
	 */
	_initializePressureProperties() {
		const inputs = this.inputLibrary.getAll();

		for (const input of inputs) {
			if (input.cssIdentifier && isButton(input)) {
				// Initialize to 0%
				this.customPropertyManager.setProperty(`${input.cssIdentifier}-pressure`, '0.0%');
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
