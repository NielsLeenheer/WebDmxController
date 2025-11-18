/**
 * Input System
 *
 * Handles various input devices (MIDI, HID, Keyboard) and exposes
 * their controls as normalized values for mapping to DMX.
 */

import { StreamDeckManager, getStreamDeckFilters, isStreamDeck, getStreamDeckModel } from './streamdeck.js';
import { MIDIDeviceProfileManager } from './midi.js';
import { Thingy52Manager } from './thingy52.js';

/**
 * Base class for all input devices
 */
class InputDevice {
	constructor(id, name, type) {
		this.id = id;
		this.name = name;
		this.type = type; // 'midi', 'hid', 'keyboard', 'virtual'
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
}

/**
 * MIDI Input Device (WebMIDI API)
 */
export class MIDIInputDevice extends InputDevice {
	constructor(midiInput, midiOutput = null, profile = null) {
		super(midiInput.id, midiInput.name || 'MIDI Device', 'midi');
		this.midiInput = midiInput;
		this.midiOutput = midiOutput; // Optional MIDI output for LED feedback
		this.profile = profile; // Device-specific profile for color mapping
		this.buttonColors = new Map(); // Track desired colors per note/pad
		this._sysexDisabled = false;
		this.midiInput.onmidimessage = this._handleMIDIMessage.bind(this);
	}

	_handleMIDIMessage(event) {
		const [status, data1, data2] = event.data;
		const command = status & 0xf0;
		const channel = status & 0x0f;

		switch (command) {
			case 0x90: // Note On
				if (data2 > 0) {
					const controlId = `note-${data1}`;
					this._trigger(controlId, data2 / 127);
				} else {
					// Note off (velocity 0)
					const controlId = `note-${data1}`;
					this._emit('release', { controlId });
				}
				break;

			case 0x80: // Note Off
				const controlId = `note-${data1}`;
				this._emit('release', { controlId });
				break;

			case 0xb0: // Control Change
				const ccId = `cc-${data1}`;
				this._setValue(ccId, data2 / 127, 0, 1);
				break;

			case 0xe0: // Pitch Bend
				const bendValue = ((data2 << 7) | data1) - 8192;
				this._setValue('pitchbend', bendValue / 8192, -1, 1);
				break;
		}
	}

	/**
	 * Send a MIDI Note On message (used for setting button LED colors)
	 * @param {number} note - Note number (0-127)
	 * @param {number} velocity - Velocity/color (0-127)
	 * @param {number} channel - MIDI channel (0-15, default 0)
	 */
	sendNoteOn(note, velocity, channel = 0) {
		if (!this.midiOutput) return;
		const status = 0x90 | (channel & 0x0f);
		this.midiOutput.send([status, note & 0x7f, velocity & 0x7f]);
	}

	/**
	 * Send a MIDI Note Off message
	 * @param {number} note - Note number (0-127)
	 * @param {number} channel - MIDI channel (0-15, default 0)
	 */
	sendNoteOff(note, channel = 0) {
		if (!this.midiOutput) return;
		const status = 0x80 | (channel & 0x0f);
		this.midiOutput.send([status, note & 0x7f, 0]);
	}

	/**
	 * Send a MIDI Control Change message
	 * @param {number} controller - Controller number (0-127)
	 * @param {number} value - Controller value (0-127)
	 * @param {number} channel - MIDI channel (0-15, default 0)
	 */
	sendControlChange(controller, value, channel = 0) {
		if (!this.midiOutput) return;
		const status = 0xb0 | (channel & 0x0f);
		this.midiOutput.send([status, controller & 0x7f, value & 0x7f]);
	}

	/**
	 * Set button color (device-agnostic, will use device profile)
	 * @param {number} button - Button/pad number
	 * @param {string|number} color - Color name or velocity value
	 */
	setButtonColor(button, color) {
		if (color === undefined || color === null) {
			this.buttonColors.delete(button);
		} else {
			this.buttonColors.set(button, color);
		}

		if (!this.midiOutput) return;

		const mode = this.profile?.colorUpdateMode || 'note';

		if (
			mode === 'sysex' &&
			!this._sysexDisabled &&
			typeof this.profile?.buildColorSysEx === 'function'
		) {
			const message = this.profile.buildColorSysEx(this.buttonColors);
			if (message && message.length) {
				try {
					this.midiOutput.send(message);
					return;
				} catch (error) {
					if (error?.name === 'InvalidAccessError') {
						console.warn('MIDI device rejected SysEx message; disabling SysEx mode for this session.', error);
						this._sysexDisabled = true;
					} else {
						console.error('Failed to send SysEx color update:', error);
					}
				}
			}
		}

		// Default to velocity-based color via NOTE ON
		const noteData = typeof this.profile?.getNoteColor === 'function'
			? this.profile.getNoteColor(button, color)
			: { note: button, velocity: this._colorToVelocity(color), channel: 0 };

		if (!noteData) return;

		const {
			note = button,
			velocity = this._colorToVelocity(color),
			channel = 0
		} = noteData;

		this.sendNoteOn(note, velocity, channel);
	}

	/**
	 * Convert color to velocity value (device-specific)
	 * Uses device profile if available
	 */
	_colorToVelocity(color) {
		// Use profile if available
		if (this.profile) {
			return this.profile.colorToVelocity(color);
		}

		// Fallback to basic mapping
		if (typeof color === 'number') return Math.max(0, Math.min(127, color));

		const colorMap = {
			'off': 0,
			'red': 5,
			'orange': 9,
			'yellow': 13,
			'green': 21,
			'cyan': 37,
			'blue': 45,
			'purple': 53,
			'pink': 57,
			'white': 3
		};

		return colorMap[color.toLowerCase()] || 0;
	}

	disconnect() {
		if (this.midiInput) {
			this.midiInput.onmidimessage = null;
		}
		// Clear all LEDs on disconnect
		if (this.midiOutput) {
			const mode = this.profile?.colorUpdateMode || 'note';
			if (
				mode === 'sysex' &&
				!this._sysexDisabled &&
				typeof this.profile?.buildColorSysEx === 'function'
			) {
				this.buttonColors.clear();
				const message = this.profile.buildColorSysEx(this.buttonColors);
				if (message && message.length) {
					try {
						this.midiOutput.send(message);
					} catch (error) {
						console.warn('Failed to send SysEx clear message on disconnect.', error);
						this._sysexDisabled = true;
					}
				}
			} else {
				for (let i = 0; i < 128; i++) {
					this.sendNoteOff(i);
				}
			}
		}
		this.buttonColors.clear();
	}
}

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

/**
 * Bluetooth Input Device (Thingy:52)
 */
export class BluetoothInputDevice extends InputDevice {
	constructor(thingyDevice) {
		super(thingyDevice.id, thingyDevice.name, 'bluetooth');
		this.thingyDevice = thingyDevice;

		// Set up button handlers
		this.thingyDevice.on('button-press', this._handleButtonPress.bind(this));
		this.thingyDevice.on('button-release', this._handleButtonRelease.bind(this));

		// Set up sensor data handlers
		this.thingyDevice.on('euler', this._handleEuler.bind(this));
		this.thingyDevice.on('quaternion', this._handleQuaternion.bind(this));
		this.thingyDevice.on('panTilt', this._handlePanTilt.bind(this));
		this.thingyDevice.on('accelerometer', this._handleAccelerometer.bind(this));
		this.thingyDevice.on('gyroscope', this._handleGyroscope.bind(this));
		this.thingyDevice.on('compass', this._handleCompass.bind(this));
	}

	_handleButtonPress() {
		this._trigger('button', 127);
	}

	_handleButtonRelease() {
		this._emit('release', { controlId: 'button' });
	}

	_handleEuler({ roll, pitch, yaw }) {
		// Euler angles: -180 to 180 degrees, normalize to 0-1
		this._setValue('euler-roll', (roll + 180) / 360, -180, 180);
		this._setValue('euler-pitch', (pitch + 180) / 360, -180, 180);
		this._setValue('euler-yaw', (yaw + 180) / 360, -180, 180);
	}

	_handleQuaternion({ w, x, y, z }) {
		// Quaternion: -1 to 1, normalize to 0-1
		this._setValue('quat-w', (w + 1) / 2, -1, 1);
		this._setValue('quat-x', (x + 1) / 2, -1, 1);
		this._setValue('quat-y', (y + 1) / 2, -1, 1);
		this._setValue('quat-z', (z + 1) / 2, -1, 1);
	}

	_handlePanTilt({ pan, tilt }) {
		// Pan: -180 to 180 degrees (horizontal rotation), normalize to 0-1
		// Tilt: -90 to 90 degrees (forward/back tilt), normalize to 0-1
		this._setValue('pan', (pan + 180) / 360, -180, 180);
		this._setValue('tilt', (tilt + 90) / 180, -90, 90);
	}

	_handleAccelerometer({ x, y, z }) {
		// Accelerometer: -4g to 4g typical range, normalize to 0-1
		this._setValue('accel-x', (x + 4) / 8, -4, 4);
		this._setValue('accel-y', (y + 4) / 8, -4, 4);
		this._setValue('accel-z', (z + 4) / 8, -4, 4);
	}

	_handleGyroscope({ x, y, z }) {
		// Gyroscope: -2000 to 2000 deg/s typical range, normalize to 0-1
		this._setValue('gyro-x', (x + 2000) / 4000, -2000, 2000);
		this._setValue('gyro-y', (y + 2000) / 4000, -2000, 2000);
		this._setValue('gyro-z', (z + 2000) / 4000, -2000, 2000);
	}

	_handleCompass({ x, y, z }) {
		// Compass: -100 to 100 µT typical range, normalize to 0-1
		this._setValue('compass-x', (x + 100) / 200, -100, 100);
		this._setValue('compass-y', (y + 100) / 200, -100, 100);
		this._setValue('compass-z', (z + 100) / 200, -100, 100);
	}

	disconnect() {
		this.thingyDevice?.disconnect();
	}
}

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

/**
 * Manages all input devices
 */
export class InputDeviceManager {
	constructor() {
		this.devices = new Map(); // deviceId -> InputDevice
		this.midiAccess = null;
		this.keyboardDevice = null;
		this.streamDeckManager = new StreamDeckManager();
		this.thingy52Manager = new Thingy52Manager();
		this.midiProfileManager = new MIDIDeviceProfileManager();
		this._setupStreamDeckListeners();
		this._setupThingy52Listeners();
	}

	/**
	 * Setup Stream Deck event listeners
	 */
	_setupStreamDeckListeners() {
		this.streamDeckManager.on('connected', ({ device, model, serialNumber }) => {
			console.log(`Stream Deck connected: ${model}`);

			// Create InputDevice wrapper immediately when Stream Deck connects
			const deviceId = serialNumber;
			const inputDevice = new InputDevice(deviceId, model || 'Stream Deck', 'hid');
			inputDevice.streamDeck = device; // Store reference to the StreamDeck instance
			this.devices.set(deviceId, inputDevice);
			this._emit('deviceadded', inputDevice);
		});

		this.streamDeckManager.on('buttondown', ({ device, button, model, serialNumber }) => {
			const deviceId = serialNumber;
			const inputDevice = this.devices.get(deviceId);

			if (inputDevice) {
				// Trigger the button via the input device
				const controlId = `button-${button}`;
				inputDevice._trigger(controlId, 127);
			}
		});

		this.streamDeckManager.on('buttonup', ({ serialNumber, button }) => {
			const deviceId = serialNumber;
			const inputDevice = this.devices.get(deviceId);

			if (inputDevice) {
				const controlId = `button-${button}`;
				inputDevice._emit('release', { controlId });
			}
		});

		this.streamDeckManager.on('disconnected', ({ serialNumber }) => {
			console.log(`Stream Deck disconnected`);
			this.removeDevice(serialNumber);
		});
	}

	/**
	 * Setup Thingy:52 event listeners
	 */
	_setupThingy52Listeners() {
		this.thingy52Manager.on('connected', ({ device }) => {
			console.log(`Thingy:52 connected: ${device.name}`);

			// Create BluetoothInputDevice wrapper
			const inputDevice = new BluetoothInputDevice(device);
			this.devices.set(device.id, inputDevice);
			this._emit('deviceadded', inputDevice);
		});

		this.thingy52Manager.on('disconnected', ({ device }) => {
			console.log(`Thingy:52 disconnected: ${device.name}`);
			this.removeDevice(device.id);
		});
	}

	/**
	 * Initialize MIDI access
	 */
	async initMIDI() {
		if (!navigator.requestMIDIAccess) {
			console.warn('WebMIDI not supported');
			return false;
		}

		try {
			this.midiAccess = await navigator.requestMIDIAccess({ sysex: true });
		} catch (firstError) {
			console.warn('SysEx-enabled MIDI access denied, retrying without SysEx.', firstError);
			try {
				this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
			} catch (fallbackError) {
				console.error('Failed to initialize MIDI:', fallbackError);
				return false;
			}
		}

		try {
			this.midiAccess.onstatechange = this._handleMIDIStateChange.bind(this);

			// Add existing MIDI inputs
			for (const input of this.midiAccess.inputs.values()) {
				this._addMIDIDevice(input);
			}

			return true;
		} catch (e) {
			console.error('Failed to configure MIDI:', e);
			return false;
		}
	}

	_handleMIDIStateChange(event) {
		const device = event.port;

		if (device.type === 'input') {
			if (device.state === 'connected') {
				this._addMIDIDevice(device);
			} else if (device.state === 'disconnected') {
				this.removeDevice(device.id);
			}
		}
	}

	_addMIDIDevice(midiInput) {
		// Try to find matching output port
		let midiOutput = null;
		if (this.midiAccess) {
			for (const output of this.midiAccess.outputs.values()) {
				// Match by name (most devices have same name for input/output)
				if (output.name === midiInput.name) {
					midiOutput = output;
					console.log(`Matched MIDI output for ${midiInput.name}`);
					break;
				}
			}
		}

		// Get device profile based on name
		const profile = this.midiProfileManager.getProfile(midiInput.name);
		console.log(`Using profile "${profile.name}" for ${midiInput.name}`);

		const device = new MIDIInputDevice(midiInput, midiOutput, profile);
		this.devices.set(device.id, device);
		this._emit('deviceadded', device);
	}

	/**
	 * Request Stream Deck device
	 */
	async requestStreamDeck() {
		try {
			return await this.streamDeckManager.requestDevice();
		} catch (error) {
			console.error('Failed to request Stream Deck:', error);
			throw error;
		}
	}

	/**
	 * Auto-reconnect to previously authorized Stream Deck devices
	 */
	async autoReconnectStreamDecks() {
		try {
			const devices = await this.streamDeckManager.autoReconnect();
			console.log(`Auto-reconnected ${devices.length} Stream Deck(s)`);
			return devices;
		} catch (error) {
			console.error('Failed to auto-reconnect Stream Decks:', error);
			return [];
		}
	}

	/**
	 * Request Thingy:52 device
	 */
	async requestThingy52() {
		try {
			return await this.thingy52Manager.requestDevice();
		} catch (error) {
			console.error('Failed to request Thingy:52:', error);
			throw error;
		}
	}

	/**
	 * Auto-reconnect to previously paired Thingy:52 devices
	 */
	async autoReconnectThingy52() {
		try {
			const devices = await this.thingy52Manager.autoReconnect();
			console.log(`Auto-reconnected ${devices.length} Thingy:52(s)`);
			return devices;
		} catch (error) {
			console.error('Failed to auto-reconnect Thingy:52 devices:', error);
			return [];
		}
	}

	/**
	 * Request generic HID device (for non-Stream Deck devices)
	 */
	async requestHIDDevice(filters = []) {
		if (!navigator.hid) {
			console.warn('WebHID not supported');
			return null;
		}

		try {
			const devices = await navigator.hid.requestDevice({ filters });

			for (const hidDevice of devices) {
				// Check if this is a Stream Deck - use StreamDeckManager instead
				if (isStreamDeck(hidDevice)) {
					return await this.streamDeckManager.connectDevice(hidDevice);
				}

				// Check if device is already open
				if (!hidDevice.opened) {
					try {
						await hidDevice.open();
					} catch (openError) {
						console.error('Failed to open HID device:', openError);
						throw new Error(`Cannot open device. Make sure it's not being used by another application. Error: ${openError.message}`);
					}
				}

				const device = new HIDInputDevice(hidDevice);
				this.devices.set(device.id, device);
				this._emit('deviceadded', device);
				return device;
			}
		} catch (e) {
			console.error('Failed to request HID device:', e);
			throw e; // Re-throw so the UI can display the error
		}

		return null;
	}

	/**
	 * Enable keyboard input
	 */
	enableKeyboard() {
		if (!this.keyboardDevice) {
			this.keyboardDevice = new KeyboardInputDevice();
			this.devices.set(this.keyboardDevice.id, this.keyboardDevice);
			this._emit('deviceadded', this.keyboardDevice);
		}
		return this.keyboardDevice;
	}

	/**
	 * Create virtual input device
	 */
	createVirtual(name) {
		const device = new VirtualInputDevice(name);
		this.devices.set(device.id, device);
		this._emit('deviceadded', device);
		return device;
	}

	/**
	 * Remove device
	 */
	removeDevice(deviceId) {
		const device = this.devices.get(deviceId);
		if (device) {
			device.disconnect();
			this.devices.delete(deviceId);
			this._emit('deviceremoved', device);
		}
	}

	/**
	 * Get device by ID
	 */
	getDevice(deviceId) {
		return this.devices.get(deviceId);
	}

	/**
	 * Get all devices
	 */
	getAllDevices() {
		return Array.from(this.devices.values());
	}

	/**
	 * Alias for getAllDevices() - used by InputsView
	 */
	getInputDevices() {
		return this.getAllDevices();
	}

	/**
	 * Alias for getDevice() - used by InputsView
	 */
	getInputDevice(deviceId) {
		return this.getDevice(deviceId);
	}

	/**
	 * Event handling
	 */
	listeners = new Map();

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
	 * Disconnect all devices
	 */
	disconnectAll() {
		for (const device of this.devices.values()) {
			device.disconnect();
		}
		this.devices.clear();
	}
}
