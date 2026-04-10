/**
 * Bluetooth Heart Rate Monitor Support
 * Uses the standard Bluetooth Heart Rate Service (0x180D)
 * Provides heart rate (BPM) and RR interval data
 */

// Standard Bluetooth Heart Rate Service UUIDs
const HEART_RATE_SERVICE = 0x180D;
const HEART_RATE_MEASUREMENT = 0x2A37;

/**
 * Represents a connected Heart Rate Monitor device
 */
class HeartRateDevice {
	constructor(bluetoothDevice) {
		this.bluetoothDevice = bluetoothDevice;
		this.server = null;
		this.heartRateService = null;
		this.listeners = new Map();

		this.currentHR = 0;
		this.currentRR = 0;      // Most recent RR interval in ms
		this.sensorContact = false;

		// Handle device disconnection
		this.bluetoothDevice.addEventListener('gattserverdisconnected', () => {
			this._emit('disconnected');
		});
	}

	get id() {
		return this.bluetoothDevice.id;
	}

	get name() {
		return this.bluetoothDevice.name || 'Heart Rate Monitor';
	}

	/**
	 * Connect to the device and subscribe to heart rate notifications
	 */
	async connect() {
		try {
			console.log('Connecting to Heart Rate Monitor...');
			this.server = await this.bluetoothDevice.gatt.connect();

			console.log('Getting Heart Rate Service...');
			this.heartRateService = await this.server.getPrimaryService(HEART_RATE_SERVICE);

			await this._subscribeToHeartRate();

			this._emit('connected');
			console.log('Heart Rate Monitor connected');
		} catch (error) {
			console.error('Failed to connect to Heart Rate Monitor:', error);
			throw error;
		}
	}

	/**
	 * Subscribe to Heart Rate Measurement notifications
	 *
	 * Data format (Bluetooth SIG Heart Rate Profile):
	 * Byte 0: Flags
	 *   Bit 0: HR format (0 = uint8, 1 = uint16)
	 *   Bit 1-2: Sensor contact status
	 *   Bit 3: Energy expended present
	 *   Bit 4: RR-Interval present
	 * Byte 1+: HR value (uint8 or uint16)
	 * Following: Energy expended (uint16, if present)
	 * Following: RR-Interval values (uint16 each, in 1/1024 seconds)
	 */
	async _subscribeToHeartRate() {
		try {
			const char = await this.heartRateService.getCharacteristic(HEART_RATE_MEASUREMENT);

			await char.startNotifications();
			char.addEventListener('characteristicvaluechanged', (event) => {
				const value = event.target.value;
				this._parseHeartRateData(value);
			});

			console.log('Subscribed to Heart Rate Measurement');
		} catch (error) {
			console.warn('Failed to subscribe to Heart Rate:', error);
		}
	}

	/**
	 * Parse the Heart Rate Measurement characteristic value
	 */
	_parseHeartRateData(dataView) {
		const flags = dataView.getUint8(0);
		let offset = 1;

		// Bit 0: Heart Rate Value Format
		const hrFormat16Bit = (flags & 0x01) !== 0;

		// Bits 1-2: Sensor Contact Status
		const sensorContactSupported = (flags & 0x04) !== 0;
		const sensorContactDetected = (flags & 0x02) !== 0;
		this.sensorContact = !sensorContactSupported || sensorContactDetected;

		// Read heart rate value
		let heartRate;
		if (hrFormat16Bit) {
			heartRate = dataView.getUint16(offset, true);
			offset += 2;
		} else {
			heartRate = dataView.getUint8(offset);
			offset += 1;
		}

		this.currentHR = heartRate;
		this._emit('heartrate', { bpm: heartRate, sensorContact: this.sensorContact });

		// Bit 3: Energy Expended Present
		const energyExpendedPresent = (flags & 0x08) !== 0;
		if (energyExpendedPresent) {
			offset += 2; // Skip energy expended (uint16)
		}

		// Bit 4: RR-Interval Present
		const rrIntervalPresent = (flags & 0x10) !== 0;
		if (rrIntervalPresent) {
			// There can be multiple RR intervals in one packet
			while (offset + 1 < dataView.byteLength) {
				// RR intervals are in 1/1024 seconds, convert to milliseconds
				const rrRaw = dataView.getUint16(offset, true);
				const rrMs = (rrRaw / 1024) * 1000;
				offset += 2;

				this.currentRR = rrMs;
				this._emit('rr-interval', { ms: rrMs });
				this._emit('beat', { rr: rrMs, bpm: this.currentHR });
			}
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
		if (index > -1) callbacks.splice(index, 1);
	}

	_emit(event, data) {
		if (!this.listeners.has(event)) return;
		this.listeners.get(event).forEach(callback => callback(data));
	}
}

/**
 * Manager for Heart Rate Monitor devices
 */
export class HeartRateManager {
	constructor() {
		this.devices = new Map();
		this.listeners = new Map();
	}

	/**
	 * Request connection to a Heart Rate Monitor
	 */
	async requestDevice() {
		if (!navigator.bluetooth) {
			throw new Error('Web Bluetooth API not supported');
		}

		try {
			const device = await navigator.bluetooth.requestDevice({
				filters: [
					{ services: [HEART_RATE_SERVICE] }
				]
			});

			return await this.connectDevice(device);
		} catch (error) {
			console.error('Failed to request Heart Rate Monitor:', error);
			throw error;
		}
	}

	/**
	 * Connect to a Bluetooth device
	 */
	async connectDevice(bluetoothDevice) {
		const hrDevice = new HeartRateDevice(bluetoothDevice);

		hrDevice.on('connected', () => {
			this.devices.set(hrDevice.id, hrDevice);
			this._emit('connected', { device: hrDevice });
		});

		hrDevice.on('disconnected', () => {
			this.devices.delete(hrDevice.id);
			this._emit('disconnected', { device: hrDevice });
		});

		hrDevice.on('heartrate', (data) => {
			this._emit('heartrate', { device: hrDevice, ...data });
		});

		hrDevice.on('rr-interval', (data) => {
			this._emit('rr-interval', { device: hrDevice, ...data });
		});

		hrDevice.on('beat', (data) => {
			this._emit('beat', { device: hrDevice, ...data });
		});

		await hrDevice.connect();
		return hrDevice;
	}

	/**
	 * Auto-reconnect to previously paired devices
	 */
	async autoReconnect() {
		if (!navigator.bluetooth || !navigator.bluetooth.getDevices) {
			return [];
		}

		try {
			const devices = await navigator.bluetooth.getDevices();
			const reconnected = [];

			for (const device of devices) {
				try {
					const hrDevice = await this.connectDevice(device);
					reconnected.push(hrDevice);
				} catch (error) {
					console.warn('Failed to reconnect Heart Rate Monitor:', error);
				}
			}

			return reconnected;
		} catch (error) {
			console.warn('Failed to auto-reconnect Heart Rate Monitors:', error);
			return [];
		}
	}

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
		if (index > -1) callbacks.splice(index, 1);
	}

	_emit(event, data) {
		if (!this.listeners.has(event)) return;
		this.listeners.get(event).forEach(callback => callback(data));
	}
}
