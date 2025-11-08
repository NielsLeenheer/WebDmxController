/**
 * Input System
 *
 * Handles various input devices (MIDI, HID, Keyboard) and exposes
 * their controls as normalized values for mapping to DMX.
 */

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
	constructor(midiInput) {
		super(midiInput.id, midiInput.name || 'MIDI Device', 'midi');
		this.midiInput = midiInput;
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

	disconnect() {
		if (this.midiInput) {
			this.midiInput.onmidimessage = null;
		}
	}
}

/**
 * HID Input Device (WebHID API) - for Stream Deck, etc
 */
/**
 * HID Input Device (Stream Deck, game controllers, etc)
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

		// Stream Deck detection: Check for common Stream Deck vendor/product IDs
		const isStreamDeck = this.hidDevice.vendorId === 0x0fd9; // Elgato vendor ID

		if (isStreamDeck) {
			this._handleStreamDeckReport(bytes, reportId);
		} else {
			this._handleGenericReport(bytes, reportId);
		}
	}

	_handleStreamDeckReport(bytes, reportId) {
		// Stream Deck sends button states in the report
		// Each button is typically one bit or one byte depending on the model

		// For Stream Deck Original/MK.2: 15 buttons, each button is 1 byte
		// For Stream Deck Mini: 6 buttons
		// For Stream Deck XL: 32 buttons

		for (let i = 0; i < bytes.length; i++) {
			const buttonPressed = bytes[i] === 1;
			const controlId = `button-${i}`;
			const wasPressed = this.buttonStates.get(controlId) || false;

			if (buttonPressed && !wasPressed) {
				// Button pressed
				this.buttonStates.set(controlId, true);
				this._trigger(controlId, 127);
			} else if (!buttonPressed && wasPressed) {
				// Button released
				this.buttonStates.set(controlId, false);
				this._emit('release', { controlId });
			}
		}
	}

	_handleGenericReport(bytes, reportId) {
		// Generic button handling for other HID devices
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
	 * Send output report (e.g., to update button LEDs on Stream Deck)
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
			this.midiAccess = await navigator.requestMIDIAccess();
			this.midiAccess.onstatechange = this._handleMIDIStateChange.bind(this);

			// Add existing MIDI inputs
			for (const input of this.midiAccess.inputs.values()) {
				this._addMIDIDevice(input);
			}

			return true;
		} catch (e) {
			console.error('Failed to initialize MIDI:', e);
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
		const device = new MIDIInputDevice(midiInput);
		this.devices.set(device.id, device);
		this._emit('deviceadded', device);
	}

	/**
	 * Request HID device
	 */
	async requestHIDDevice(filters = []) {
		if (!navigator.hid) {
			console.warn('WebHID not supported');
			return null;
		}

		try {
			const devices = await navigator.hid.requestDevice({ filters });

			for (const hidDevice of devices) {
				// Check if device is already open
				if (!hidDevice.opened) {
					try {
						await hidDevice.open();
					} catch (openError) {
						console.error('Failed to open HID device:', openError);
						throw new Error(`Cannot open device. Make sure it's not being used by another application (like Elgato Stream Deck software). Error: ${openError.message}`);
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
