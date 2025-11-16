/**
 * Nordic Thingy:52 Bluetooth LE Support
 * Provides access to Thingy:52 sensors for use as input controls
 */

// Thingy:52 Service UUIDs
const THINGY_UI_SERVICE = 'ef680300-9b35-4933-9b10-52ffa9740042';
const THINGY_MOTION_SERVICE = 'ef680400-9b35-4933-9b10-52ffa9740042';

// Thingy:52 UI Characteristic UUIDs
const THINGY_UI_BUTTON = 'ef680302-9b35-4933-9b10-52ffa9740042';

// Thingy:52 Motion Characteristic UUIDs
const THINGY_MOTION_CONFIG = 'ef680401-9b35-4933-9b10-52ffa9740042';
const THINGY_MOTION_TAP = 'ef680402-9b35-4933-9b10-52ffa9740042';
const THINGY_MOTION_ORIENTATION = 'ef680403-9b35-4933-9b10-52ffa9740042';
const THINGY_MOTION_QUATERNION = 'ef680404-9b35-4933-9b10-52ffa9740042';
const THINGY_MOTION_PEDOMETER = 'ef680405-9b35-4933-9b10-52ffa9740042';
const THINGY_MOTION_RAW = 'ef680406-9b35-4933-9b10-52ffa9740042';
const THINGY_MOTION_EULER = 'ef680407-9b35-4933-9b10-52ffa9740042';
const THINGY_MOTION_ROTATION_MATRIX = 'ef680408-9b35-4933-9b10-52ffa9740042';
const THINGY_MOTION_HEADING = 'ef680409-9b35-4933-9b10-52ffa9740042';
const THINGY_MOTION_GRAVITY = 'ef68040a-9b35-4933-9b10-52ffa9740042';

/**
 * Represents a connected Thingy:52 device
 */
export class Thingy52Device {
	constructor(bluetoothDevice) {
		this.bluetoothDevice = bluetoothDevice;
		this.server = null;
		this.uiService = null;
		this.motionService = null;
		this.characteristics = new Map();
		this.listeners = new Map();
		this.sensorData = {
			euler: { roll: 0, pitch: 0, yaw: 0 },
			quaternion: { w: 1, x: 0, y: 0, z: 0 },
			accelerometer: { x: 0, y: 0, z: 0 },
			gyroscope: { x: 0, y: 0, z: 0 },
			compass: { x: 0, y: 0, z: 0 }
		};

		// Handle device disconnection
		this.bluetoothDevice.addEventListener('gattserverdisconnected', () => {
			this._emit('disconnected');
		});
	}

	get id() {
		return this.bluetoothDevice.id;
	}

	get name() {
		return this.bluetoothDevice.name || 'Thingy:52';
	}

	/**
	 * Connect to the device and initialize services
	 */
	async connect() {
		try {
			console.log('Connecting to GATT Server...');
			this.server = await this.bluetoothDevice.gatt.connect();

			console.log('Getting UI Service...');
			this.uiService = await this.server.getPrimaryService(THINGY_UI_SERVICE);

			console.log('Getting Motion Service...');
			this.motionService = await this.server.getPrimaryService(THINGY_MOTION_SERVICE);

			// Subscribe to button
			await this._subscribeToButton();

			// Enable sensors by configuring the motion service
			await this._configureMotionService();

			// Subscribe to sensor characteristics
			await this._subscribeToEuler();
			await this._subscribeToQuaternion();
			await this._subscribeToRawMotion();

			this._emit('connected');
			console.log('Thingy:52 connected and configured');
		} catch (error) {
			console.error('Failed to connect to Thingy:52:', error);
			throw error;
		}
	}

	/**
	 * Configure motion service (enable sensors)
	 */
	async _configureMotionService() {
		try {
			const configChar = await this.motionService.getCharacteristic(THINGY_MOTION_CONFIG);

			// Configuration:
			// Byte 0-1: Step counter interval (ms) - 0x00C8 = 200ms
			// Byte 2-3: Temperature compensation interval (ms) - 0x0096 = 150ms
			// Byte 4-5: Magnetometer compensation interval (ms) - 0x0064 = 100ms
			// Byte 6-7: Motion processing frequency (Hz) - 0x0005 = 5Hz
			// Byte 8: Wake on motion - 0x01 = enabled
			const config = new Uint8Array([
				0xC8, 0x00,  // Step counter interval: 200ms
				0x96, 0x00,  // Temp compensation: 150ms
				0x64, 0x00,  // Mag compensation: 100ms
				0x14, 0x00,  // Motion freq: 20Hz
				0x01         // Wake on motion: enabled
			]);

			await configChar.writeValue(config);
			console.log('Motion service configured');
		} catch (error) {
			console.warn('Failed to configure motion service:', error);
		}
	}

	/**
	 * Subscribe to button notifications
	 */
	async _subscribeToButton() {
		try {
			const char = await this.uiService.getCharacteristic(THINGY_UI_BUTTON);
			this.characteristics.set('button', char);

			await char.startNotifications();
			char.addEventListener('characteristicvaluechanged', (event) => {
				const value = event.target.value;
				// Button state: 0 = released, 1 = pressed
				const pressed = value.getUint8(0) === 1;

				if (pressed) {
					this._emit('button-press');
				} else {
					this._emit('button-release');
				}
			});

			console.log('Subscribed to button');
		} catch (error) {
			console.warn('Failed to subscribe to button:', error);
		}
	}

	/**
	 * Subscribe to Euler angle notifications
	 */
	async _subscribeToEuler() {
		try {
			const char = await this.motionService.getCharacteristic(THINGY_MOTION_EULER);
			this.characteristics.set('euler', char);

			await char.startNotifications();
			char.addEventListener('characteristicvaluechanged', (event) => {
				const value = event.target.value;
				// Euler angles are sent as 3 x int32 (little endian) in degrees * 65536
				const roll = value.getInt32(0, true) / 65536;
				const pitch = value.getInt32(4, true) / 65536;
				const yaw = value.getInt32(8, true) / 65536;

				this.sensorData.euler = { roll, pitch, yaw };
				this._emit('euler', { roll, pitch, yaw });
			});

			console.log('Subscribed to Euler angles');
		} catch (error) {
			console.warn('Failed to subscribe to Euler:', error);
		}
	}

	/**
	 * Subscribe to Quaternion notifications
	 */
	async _subscribeToQuaternion() {
		try {
			const char = await this.motionService.getCharacteristic(THINGY_MOTION_QUATERNION);
			this.characteristics.set('quaternion', char);

			await char.startNotifications();
			char.addEventListener('characteristicvaluechanged', (event) => {
				const value = event.target.value;
				// Quaternion is sent as 4 x int32 (little endian) * 2^30
				const w = value.getInt32(0, true) / (1 << 30);
				const x = value.getInt32(4, true) / (1 << 30);
				const y = value.getInt32(8, true) / (1 << 30);
				const z = value.getInt32(12, true) / (1 << 30);

				this.sensorData.quaternion = { w, x, y, z };
				this._emit('quaternion', { w, x, y, z });
			});

			console.log('Subscribed to Quaternion');
		} catch (error) {
			console.warn('Failed to subscribe to Quaternion:', error);
		}
	}

	/**
	 * Subscribe to Raw Motion data (accelerometer, gyroscope, compass)
	 */
	async _subscribeToRawMotion() {
		try {
			const char = await this.motionService.getCharacteristic(THINGY_MOTION_RAW);
			this.characteristics.set('raw', char);

			await char.startNotifications();
			char.addEventListener('characteristicvaluechanged', (event) => {
				const value = event.target.value;
				// Raw motion data:
				// 3 x int16 (accel) + 3 x int16 (gyro) + 3 x int16 (compass)
				// Accelerometer in mg (milli-g)
				const accelX = value.getInt16(0, true) / 1000;  // Convert to g
				const accelY = value.getInt16(2, true) / 1000;
				const accelZ = value.getInt16(4, true) / 1000;

				// Gyroscope in degrees/second
				const gyroX = value.getInt16(6, true) / 100;
				const gyroY = value.getInt16(8, true) / 100;
				const gyroZ = value.getInt16(10, true) / 100;

				// Compass in µT (microTesla)
				const compassX = value.getInt16(12, true) / 100;
				const compassY = value.getInt16(14, true) / 100;
				const compassZ = value.getInt16(16, true) / 100;

				this.sensorData.accelerometer = { x: accelX, y: accelY, z: accelZ };
				this.sensorData.gyroscope = { x: gyroX, y: gyroY, z: gyroZ };
				this.sensorData.compass = { x: compassX, y: compassY, z: compassZ };

				this._emit('accelerometer', { x: accelX, y: accelY, z: accelZ });
				this._emit('gyroscope', { x: gyroX, y: gyroY, z: gyroZ });
				this._emit('compass', { x: compassX, y: compassY, z: compassZ });
			});

			console.log('Subscribed to Raw Motion');
		} catch (error) {
			console.warn('Failed to subscribe to Raw Motion:', error);
		}
	}

	/**
	 * Disconnect from device
	 */
	disconnect() {
		if (this.server && this.server.connected) {
			this.bluetoothDevice.gatt.disconnect();
		}
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
		if (index > -1) {
			callbacks.splice(index, 1);
		}
	}

	/**
	 * Emit event
	 */
	_emit(event, data) {
		if (!this.listeners.has(event)) return;
		this.listeners.get(event).forEach(callback => callback(data));
	}
}

/**
 * Manager for Thingy:52 devices
 */
export class Thingy52Manager {
	constructor() {
		this.devices = new Map();
		this.listeners = new Map();
	}

	/**
	 * Request connection to a Thingy:52 device
	 */
	async requestDevice() {
		if (!navigator.bluetooth) {
			throw new Error('Web Bluetooth API not supported');
		}

		try {
			// Request device with motion and UI services
			const device = await navigator.bluetooth.requestDevice({
				filters: [
					{ services: [THINGY_MOTION_SERVICE] },
					{ namePrefix: 'Thingy' }
				],
				optionalServices: [THINGY_MOTION_SERVICE, THINGY_UI_SERVICE]
			});

			return await this.connectDevice(device);
		} catch (error) {
			console.error('Failed to request Thingy:52:', error);
			throw error;
		}
	}

	/**
	 * Connect to a Bluetooth device
	 */
	async connectDevice(bluetoothDevice) {
		const thingy = new Thingy52Device(bluetoothDevice);

		// Set up event forwarding
		thingy.on('connected', () => {
			this.devices.set(thingy.id, thingy);
			this._emit('connected', { device: thingy });
		});

		thingy.on('disconnected', () => {
			this.devices.delete(thingy.id);
			this._emit('disconnected', { device: thingy });
		});

		thingy.on('euler', (data) => {
			this._emit('euler', { device: thingy, ...data });
		});

		thingy.on('quaternion', (data) => {
			this._emit('quaternion', { device: thingy, ...data });
		});

		thingy.on('accelerometer', (data) => {
			this._emit('accelerometer', { device: thingy, ...data });
		});

		thingy.on('gyroscope', (data) => {
			this._emit('gyroscope', { device: thingy, ...data });
		});

		thingy.on('compass', (data) => {
			this._emit('compass', { device: thingy, ...data });
		});

		await thingy.connect();
		return thingy;
	}

	/**
	 * Auto-reconnect to previously paired devices
	 */
	async autoReconnect() {
		if (!navigator.bluetooth || !navigator.bluetooth.getDevices) {
			console.warn('Bluetooth getDevices not supported');
			return [];
		}

		try {
			const devices = await navigator.bluetooth.getDevices();
			const reconnectedDevices = [];

			for (const device of devices) {
				try {
					const thingy = await this.connectDevice(device);
					reconnectedDevices.push(thingy);
				} catch (error) {
					console.warn('Failed to reconnect to Thingy:52:', error);
				}
			}

			return reconnectedDevices;
		} catch (error) {
			console.warn('Failed to auto-reconnect Thingy:52 devices:', error);
			return [];
		}
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
		if (index > -1) {
			callbacks.splice(index, 1);
		}
	}

	/**
	 * Emit event
	 */
	_emit(event, data) {
		if (!this.listeners.has(event)) return;
		this.listeners.get(event).forEach(callback => callback(data));
	}
}
