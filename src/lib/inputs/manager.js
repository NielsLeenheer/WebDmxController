/**
 * Input Device Manager
 *
 * Manages all input devices (MIDI, HID, Keyboard, Bluetooth, Gamepad) and exposes
 * their controls as normalized values for mapping to DMX.
 */

import { StreamDeckManager, isStreamDeck } from './streamdeck.js';
import { MIDIDeviceProfileManager } from './midi.js';
import { Thingy52Manager } from './thingy52.js';
import { GamepadManager } from './gamepad.js';
import { 
	InputDevice,
	KeyboardInputDevice, 
	MIDIInputDevice, 
	HIDInputDevice,
	StreamDeckInputDevice,
	ThingyInputDevice,
	GamepadInputDevice,
} from './devices.js';

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
		this.gamepadManager = new GamepadManager();
		this._setupStreamDeckListeners();
		this._setupThingy52Listeners();
		this._setupGamepadListeners();
	}

	/**
	 * Setup Stream Deck event listeners
	 */
	_setupStreamDeckListeners() {
		this.streamDeckManager.on('connected', ({ device, model, serialNumber, buttonCount }) => {
			console.log(`Stream Deck connected: ${model}`);

			// Create StreamDeckInputDevice wrapper with manager reference
			const inputDevice = new StreamDeckInputDevice(device, serialNumber, model, this.streamDeckManager, buttonCount);
			this.devices.set(serialNumber, inputDevice);
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

			// Create ThingyInputDevice wrapper
			const inputDevice = new ThingyInputDevice(device);
			this.devices.set(device.id, inputDevice);
			this._emit('deviceadded', inputDevice);
		});

		this.thingy52Manager.on('disconnected', ({ device }) => {
			console.log(`Thingy:52 disconnected: ${device.name}`);
			this.removeDevice(device.id);
		});
	}

	/**
	 * Setup Gamepad event listeners
	 */
	_setupGamepadListeners() {
		// Track mapping from gamepad index to device ID (since index can change on reconnect)
		this.gamepadIndexToDeviceId = new Map();

		this.gamepadManager.on('connected', ({ gamepad, gamepadId }) => {
			// gamecontroller.js uses gamepad.id for the index
			console.log(`Gamepad connected: index ${gamepad.id}, stable ID: ${gamepadId}`);

			// Create GamepadInputDevice wrapper with stable ID
			const inputDevice = new GamepadInputDevice(gamepad, gamepadId);
			this.devices.set(inputDevice.id, inputDevice);

			// Track the mapping from current index to stable device ID
			this.gamepadIndexToDeviceId.set(gamepad.id, inputDevice.id);

			this._emit('deviceadded', inputDevice);
		});

		this.gamepadManager.on('disconnected', ({ gamepadIndex, gamepadId }) => {
			console.log(`Gamepad disconnected: index ${gamepadIndex}`);

			// Look up the device ID from the index mapping
			const deviceId = this.gamepadIndexToDeviceId.get(gamepadIndex);
			if (deviceId) {
				this.gamepadIndexToDeviceId.delete(gamepadIndex);
				this.removeDevice(deviceId);
			}
		});

		this.gamepadManager.on('buttondown', ({ gamepadIndex, button, buttonName }) => {
			const deviceId = this.gamepadIndexToDeviceId.get(gamepadIndex);
			const inputDevice = this.devices.get(deviceId);
			console.log(`Manager received buttondown: gamepad ${gamepadIndex}, button ${button}, device found: ${!!inputDevice}`);

			if (inputDevice) {
				inputDevice.handleButtonDown(button, buttonName);
			}
		});

		this.gamepadManager.on('buttonup', ({ gamepadIndex, button }) => {
			const deviceId = this.gamepadIndexToDeviceId.get(gamepadIndex);
			const inputDevice = this.devices.get(deviceId);

			if (inputDevice) {
				inputDevice.handleButtonUp(button);
			}
		});

		this.gamepadManager.on('axismove', ({ gamepadIndex, axis, axeName, value }) => {
			const deviceId = this.gamepadIndexToDeviceId.get(gamepadIndex);
			const inputDevice = this.devices.get(deviceId);

			if (inputDevice) {
				inputDevice.handleAxisMove(axis, axeName, value);
			}
		});
	}

	/**
	 * Initialize Gamepad support
	 */
	initGamepads() {
		this.gamepadManager.init();
		console.log('Gamepad support initialized');
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
