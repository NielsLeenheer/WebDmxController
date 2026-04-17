/**
 * Joy-Con WebHID wrapper
 *
 * Thin adapter around the joy-con-webhid library by @tomayac.
 * Translates the library's 'hidinput' CustomEvents into the simple
 * event interface (button-press, button-release, stick, accelerometer,
 * gyroscope) that JoyConInputDevice expects.
 */

let connectJoyCon, connectedJoyCons, JoyConLeft, JoyConRight;

async function loadJoyConLib() {
	if (!connectJoyCon) {
		const mod = await import('joy-con-webhid');
		connectJoyCon = mod.connectJoyCon;
		connectedJoyCons = mod.connectedJoyCons;
		JoyConLeft = mod.JoyConLeft;
		JoyConRight = mod.JoyConRight;
	}
}

const PRODUCT_ID_LEFT = 0x2006;

// Button keys the library uses (from CompleteButtonStatus).
// The library uses 'rightStick'/'leftStick'; we normalise to 'stickButton'.
const BUTTON_KEYS = [
	'y', 'x', 'b', 'a', 'r', 'zr',
	'down', 'up', 'right', 'left', 'l', 'zl',
	'sr', 'sl', 'minus', 'plus',
	'rightStick', 'leftStick',
	'home', 'capture',
];

/**
 * Wraps a joy-con-webhid JoyCon instance, exposing the same event interface
 * that JoyConInputDevice relies on.
 */
class JoyConDeviceAdapter {
	constructor(libJoyCon) {
		this._lib = libJoyCon;
		this.listeners = new Map();

		this.side = libJoyCon.device.productId === PRODUCT_ID_LEFT ? 'left' : 'right';

		this._prevButtons = {};
		for (const k of BUTTON_KEYS) this._prevButtons[k] = false;

		this._prevStick = { x: 0, y: 0 };
	}

	get id() {
		return `joycon-${this.side}-${this._lib.device.productId}`;
	}

	get name() {
		return `Joy-Con (${this.side === 'left' ? 'L' : 'R'})`;
	}

	/**
	 * Start listening to an already-initialized library Joy-Con.
	 */
	async connect() {
		const jc = this._lib;
		jc.on('hidinput', (event) => this._onHIDInput(event));
		this._emit('connected');
	}

	async disconnect() {
		// The library doesn't expose a close() — just stop listening
		this._emit('disconnected');
	}

	// ── hidinput → our events ──────────────────────────────────

	_onHIDInput(event) {
		const d = event.detail;
		if (!d) return;

		// Buttons
		const bs = d.buttonStatus;
		if (bs) {
			for (const key of BUTTON_KEYS) {
				const pressed = !!bs[key];
				const wasPressed = this._prevButtons[key];
				if (pressed && !wasPressed) {
					// Normalise rightStick/leftStick → stickButton
					const button = (key === 'rightStick' || key === 'leftStick') ? 'stickButton' : key;
					this._emit('button-press', { button });
				} else if (!pressed && wasPressed) {
					const button = (key === 'rightStick' || key === 'leftStick') ? 'stickButton' : key;
					this._emit('button-release', { button });
				}
				this._prevButtons[key] = pressed;
			}
		}

		// Stick — library gives { horizontal: string, vertical: string } in -2..2 range
		const stick = this.side === 'left' ? d.analogStickLeft : d.analogStickRight;
		if (stick && stick.horizontal !== undefined) {
			// Library range is roughly -2..2, normalise to 0..1 with 0.5 center
			const x = Math.max(0, Math.min(1, parseFloat(stick.horizontal) / 4 + 0.5));
			const y = Math.max(0, Math.min(1, parseFloat(stick.vertical) / 4 + 0.5));

			if (Math.abs(x - this._prevStick.x) > 0.01 || Math.abs(y - this._prevStick.y) > 0.01) {
				this._prevStick = { x, y };
				this._emit('stick', { x, y });
			}
		}

		// Accelerometer
		const accel = d.actualAccelerometer;
		if (accel) {
			this._emit('accelerometer', { x: accel.x, y: accel.y, z: accel.z });
		}

		// Gyroscope
		const gyro = d.actualGyroscope;
		if (gyro && gyro.dps) {
			this._emit('gyroscope', { x: gyro.dps.x, y: gyro.dps.y, z: gyro.dps.z });
		}

		// Orientation (complementary filter — the quaternion version is broken
		// because the library snapshots the quaternion before Madgwick initializes)
		const ori = d.actualOrientation;
		if (ori) {
			const alpha = parseFloat(ori.alpha);
			const beta = parseFloat(ori.beta);
			const gamma = parseFloat(ori.gamma);
			if (!isNaN(alpha) && !isNaN(beta)) {
				this._emit('orientation', { alpha, beta, gamma });
			}
		}
	}

	// ── Event Emitter ──────────────────────────────────────────

	on(event, callback) {
		if (!this.listeners.has(event)) this.listeners.set(event, []);
		this.listeners.get(event).push(callback);
	}

	off(event, callback) {
		if (!this.listeners.has(event)) return;
		const cbs = this.listeners.get(event);
		const i = cbs.indexOf(callback);
		if (i > -1) cbs.splice(i, 1);
	}

	_emit(event, data) {
		if (!this.listeners.has(event)) return;
		for (const cb of this.listeners.get(event)) cb(data);
	}
}

/**
 * Manager for Joy-Con devices.
 * Wraps the joy-con-webhid library's global state.
 */
export class JoyConManager {
	constructor() {
		this.devices = new Map();   // id → JoyConDeviceAdapter
		this.listeners = new Map();
		this._knownHIDs = new Set(); // track already-wrapped HIDDevices
	}

	/**
	 * Prompt user to pair a Joy-Con via WebHID chooser.
	 */
	async requestDevice() {
		if (!navigator.hid) {
			throw new Error('WebHID not supported in this browser');
		}

		await loadJoyConLib();
		await connectJoyCon();

		// The library populates connectedJoyCons synchronously after connect.
		// Wrap any new ones we haven't seen yet.
		await this._syncConnected();
	}

	/**
	 * Poll connectedJoyCons for new devices and wrap them.
	 */
	async _syncConnected() {
		for (const [, libJoyCon] of connectedJoyCons) {
			if (!(libJoyCon instanceof JoyConLeft || libJoyCon instanceof JoyConRight)) continue;
			if (this._knownHIDs.has(libJoyCon.device)) continue;

			this._knownHIDs.add(libJoyCon.device);
			const adapter = new JoyConDeviceAdapter(libJoyCon);

			adapter.on('connected', () => {
				this.devices.set(adapter.id, adapter);
				this._emit('connected', { device: adapter });
			});

			adapter.on('disconnected', () => {
				this.devices.delete(adapter.id);
				this._emit('disconnected', { device: adapter });
			});

			await adapter.connect();
		}
	}

	// ── Event Emitter ──────────────────────────────────────────

	on(event, callback) {
		if (!this.listeners.has(event)) this.listeners.set(event, []);
		this.listeners.get(event).push(callback);
	}

	off(event, callback) {
		if (!this.listeners.has(event)) return;
		const cbs = this.listeners.get(event);
		const i = cbs.indexOf(callback);
		if (i > -1) cbs.splice(i, 1);
	}

	_emit(event, data) {
		if (!this.listeners.has(event)) return;
		for (const cb of this.listeners.get(event)) cb(data);
	}
}
