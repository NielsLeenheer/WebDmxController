import { InputDevice } from './InputDevice.js';

/**
 * Thingy:52 Input Device (Bluetooth)
 */
export class ThingyInputDevice extends InputDevice {
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

	/**
	 * Set color for a control (button LED)
	 * @param {string} controlId - Control identifier (should be 'button')
	 * @param {string} color - Palette color name
	 */
	async setColor(controlId, color) {
		if (controlId === 'button' && this.thingyDevice) {
			await this.thingyDevice.setDeviceColor(color);
		}
	}

	disconnect() {
		this.thingyDevice?.disconnect();
	}
}
