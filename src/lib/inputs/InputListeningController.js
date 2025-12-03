/**
 * InputListeningController
 * 
 * Handles "listening mode" for detecting and registering new inputs from devices.
 * When listening is enabled, any button press or control change from connected
 * devices will automatically create a new input in the library.
 */

import { formatInputName } from './utils.js';

export class InputListeningController {
	#inputController;
	#inputLibrary;
	#isListening = false;
	#eventHandlers = [];
	#boundHandleDeviceAdded;

	/**
	 * @param {InputController} inputController - The input controller for device access
	 * @param {InputLibrary} inputLibrary - The input library for storing inputs
	 */
	constructor(inputController, inputLibrary) {
		this.#inputController = inputController;
		this.#inputLibrary = inputLibrary;
		this.#boundHandleDeviceAdded = this.#handleDeviceAdded.bind(this);
	}

	/**
	 * Check if currently listening for inputs
	 * @returns {boolean}
	 */
	get isListening() {
		return this.#isListening;
	}

	/**
	 * Start listening for new inputs from all connected devices
	 */
	startListening() {
		if (this.#isListening) return;
		
		this.#isListening = true;

		// Listen to all currently connected devices
		const devices = this.#inputController.getInputDevices();
		for (const device of devices) {
			this.#attachDeviceListeners(device);
		}

		// Listen for newly connected devices
		this.#inputController.on('deviceadded', this.#boundHandleDeviceAdded);
	}

	/**
	 * Stop listening for new inputs
	 */
	stopListening() {
		if (!this.#isListening) return;

		this.#isListening = false;

		// Remove all event handlers from devices
		for (const { device, event, handler } of this.#eventHandlers) {
			device.off(event, handler);
		}
		this.#eventHandlers = [];

		// Stop listening for new devices
		this.#inputController.off('deviceadded', this.#boundHandleDeviceAdded);
	}

	/**
	 * Attach listeners to a device for input detection
	 * @private
	 */
	#attachDeviceListeners(device) {
		const handler = (eventData) => {
			this.#handleRawInput({
				deviceId: device.id,
				controlId: eventData.controlId,
				type: eventData.type,
				colorSupport: eventData.colorSupport,
				friendlyName: eventData.friendlyName,
				orientation: eventData.orientation,
				deviceBrand: eventData.deviceBrand,
				device
			});
		};

		device.on('trigger', handler);
		device.on('change', handler);

		this.#eventHandlers.push({ device, event: 'trigger', handler });
		this.#eventHandlers.push({ device, event: 'change', handler });
	}

	/**
	 * Handle device added while listening
	 * @private
	 */
	#handleDeviceAdded(device) {
		if (!this.#isListening) return;
		this.#attachDeviceListeners(device);
	}

	/**
	 * Handle raw input from a device
	 * @private
	 */
	#handleRawInput(event) {
		if (!this.#isListening) return;

		const { deviceId, controlId, device, type, colorSupport, friendlyName, orientation, deviceBrand } = event;

		// Skip Thingy:52 inputs - they are added via the connect dialog, not by listening
		if (device?.type === 'thingy') return;

		// Check if this input already exists
		const existing = this.#inputLibrary.findByDeviceControl(deviceId, controlId);

		if (!existing) {
			// Generate a name for the input
			const name = friendlyName || formatInputName(device?.name || deviceId, controlId);

			// Create the input (library emits event, controller syncs hardware)
			this.#inputLibrary.create({
				name,
				deviceId,
				deviceName: device?.name || deviceId,
				controlId,
				controlName: friendlyName || null,
				type: type || 'button',
				colorSupport: colorSupport || 'none',
				orientation: orientation || null,
				deviceBrand: deviceBrand || null
			});
		}
	}
}
