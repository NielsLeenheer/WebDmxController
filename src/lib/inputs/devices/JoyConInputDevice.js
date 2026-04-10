import { InputDevice } from './InputDevice.js';

const FRIENDLY_NAMES = {
	'a': 'A', 'b': 'B', 'x': 'X', 'y': 'Y',
	'l': 'L', 'r': 'R', 'zl': 'ZL', 'zr': 'ZR',
	'plus': 'Plus', 'minus': 'Minus', 'home': 'Home', 'capture': 'Capture',
	'stickButton': 'Stick', 'sl': 'SL', 'sr': 'SR',
	'up': 'Up', 'down': 'Down', 'left': 'Left', 'right': 'Right'
};

/**
 * Nintendo Joy-Con Input Device (WebHID)
 *
 * Mixed model:
 * - Buttons emit 'trigger'/'release' with individual controlIds (discovered via listening mode)
 * - The configured draw button emits 'draw-start'/'draw-end' instead (invisible to listening mode)
 * - Stick emits 'change' with type 'stick' (discovered via listening mode)
 * - Sensors emit 'sensor' event (not 'change') for CSS property export only
 */
export class JoyConInputDevice extends InputDevice {
	constructor(joyConDevice) {
		super(joyConDevice.id, joyConDevice.name, 'joycon');
		this.joyConDevice = joyConDevice;
		this.side = joyConDevice.side; // 'left' or 'right'
		this.brand = 'nintendo';
		this.drawButton = this.side === 'left' ? 'zl' : 'zr';
		this.clearButton = this.side === 'left' ? 'l' : 'r';

		// Button events → individual trigger/release (like gamepad buttons)
		this.joyConDevice.on('button-press', this._handleButtonPress.bind(this));
		this.joyConDevice.on('button-release', this._handleButtonRelease.bind(this));

		// Stick → composite stick change (like gamepad sticks)
		this.joyConDevice.on('stick', this._handleStick.bind(this));

		// IMU sensors → 'sensor' event (not 'change', so InputListeningController ignores them)
		this.joyConDevice.on('accelerometer', this._handleAccelerometer.bind(this));
		this.joyConDevice.on('gyroscope', this._handleGyroscope.bind(this));
		this.joyConDevice.on('orientation', this._handleOrientation.bind(this));
	}

	_handleButtonPress({ button }) {
		if (button === this.drawButton) {
			this._emit('draw-start', { controlId: button });
			return;
		}
		if (button === this.clearButton) {
			this._emit('draw-clear', { controlId: button });
			return;
		}
		// Stick button → same controlId as stick movement so they form one control
		const controlId = button === 'stickButton' ? 'stick' : button;
		const type = button === 'stickButton' ? 'stick' : 'button';
		this._emit('trigger', {
			controlId,
			velocity: 127,
			type,
			colorSupport: 'none',
			friendlyName: FRIENDLY_NAMES[button] || button,
			deviceBrand: this.brand
		});
	}

	_handleButtonRelease({ button }) {
		if (button === this.drawButton) {
			this._emit('draw-end', { controlId: button });
			return;
		}
		if (button === this.clearButton) return; // clear is instant, no release action
		const controlId = button === 'stickButton' ? 'stick' : button;
		this._emit('release', { controlId });
	}

	_handleStick({ x, y }) {
		// Convert from 0..1 (center 0.5) to -1..1 (center 0) to match gamepad convention
		this._emit('change', {
			controlId: 'stick',
			type: 'stick',
			x: (x - 0.5) * 2,
			y: (y - 0.5) * 2,
			colorSupport: 'none',
			friendlyName: 'Stick'
		});
	}

	_handleAccelerometer({ x, y, z }) {
		// Emit on separate 'sensor' channel — not picked up by InputListeningController
		this._emit('sensor', {
			controlId: 'accel-x', value: (x + 4) / 8,
		});
		this._emit('sensor', {
			controlId: 'accel-y', value: (y + 4) / 8,
		});
		this._emit('sensor', {
			controlId: 'accel-z', value: (z + 4) / 8,
		});

		// Store raw accel (gravity direction) for gyro frame transformation
		this._lastAccel = { x, y, z };
	}

	_handleGyroscope({ x, y, z }) {
		// actualGyroscope.dps values are integrated degrees per sample period (~15ms),
		// NOT raw degrees-per-second. Typical range: ±20 degrees for vigorous waving.
		const normalize = (v) => Math.max(0, Math.min(1, (v + 20) / 40));
		this._emit('sensor', {
			controlId: 'gyro-x', value: normalize(x),
		});
		this._emit('sensor', {
			controlId: 'gyro-y', value: normalize(y),
		});
		this._emit('sensor', {
			controlId: 'gyro-z', value: normalize(z),
		});

		// Also emit raw gyro deltas for drawing, paired with gravity for frame transformation
		const accel = this._lastAccel || { x: 0, y: -1, z: 0 };
		this._emit('gyro-raw', { dx: x, dy: y, dz: z, gx: accel.x, gy: accel.y, gz: accel.z });
	}

	_handleOrientation({ alpha, beta, gamma }) {
		// Absolute angles from the Madgwick complementary filter.
		// Used directly by the drawing system for cursor positioning.
		this._emit('orientation', { alpha, beta, gamma });
	}

	disconnect() {
		this.joyConDevice?.disconnect();
	}
}
