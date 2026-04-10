import { InputDevice } from './InputDevice.js';

/**
 * Heart Rate Monitor Input Device (Bluetooth)
 *
 * Exposes:
 * - heartrate: current BPM as a continuous value (0-220)
 * - beat: a 1→0 pulse that fires on each heartbeat and decays to 0
 * - trigger/release events for each beat (enables CSS class triggers)
 */
export class HeartRateInputDevice extends InputDevice {
	constructor(heartRateDevice) {
		super(heartRateDevice.id, heartRateDevice.name, 'heartrate');
		this.heartRateDevice = heartRateDevice;

		// Beat pulse state
		this._beatValue = 0;
		this._beatDecayTimer = null;
		this._beatAnimFrame = null;
		this._lastBeatTime = 0;
		this._currentRR = 800; // Default ~75 BPM

		this.heartRateDevice.on('heartrate', this._handleHeartRate.bind(this));
		this.heartRateDevice.on('rr-interval', this._handleRRInterval.bind(this));
		this.heartRateDevice.on('beat', this._handleBeat.bind(this));
	}

	_handleHeartRate({ bpm }) {
		// Clamp to 0-220 BPM range, normalize to 0-1
		const clamped = Math.max(0, Math.min(220, bpm));
		this._setValue('heartrate', clamped / 220, 0, 220);
	}

	_handleRRInterval({ ms }) {
		this._currentRR = ms;
	}

	_handleBeat() {
		// Emit trigger (beat down)
		this._emit('trigger', {
			controlId: 'heartrate',
			velocity: 127,
			type: 'button',
			colorSupport: 'none',
			friendlyName: 'Heartbeat'
		});

		// Start the beat pulse: jumps to 1, decays to 0 over the RR interval
		this._lastBeatTime = performance.now();
		this._beatValue = 1;

		// Emit the beat value immediately at 1
		this._setValue('beat', 1, 0, 1);

		// Start decay animation
		this._startBeatDecay();

		// Schedule release after a short "down" duration (20% of RR interval)
		const downDuration = Math.min(this._currentRR * 0.2, 150);

		if (this._beatDecayTimer) clearTimeout(this._beatDecayTimer);
		this._beatDecayTimer = setTimeout(() => {
			this._emit('release', { controlId: 'heartrate' });
		}, downDuration);
	}

	/**
	 * Animate the beat value from 1 → 0 using requestAnimationFrame
	 * Decays over the current RR interval using an ease-out curve
	 */
	_startBeatDecay() {
		if (this._beatAnimFrame) cancelAnimationFrame(this._beatAnimFrame);

		const decay = () => {
			const elapsed = performance.now() - this._lastBeatTime;
			const duration = this._currentRR;

			if (elapsed >= duration) {
				this._beatValue = 0;
				this._setValue('beat', 0, 0, 1);
				this._beatAnimFrame = null;
				return;
			}

			// Ease-out: fast drop then slow tail
			const t = elapsed / duration;
			this._beatValue = 1 - (t * t);

			this._setValue('beat', this._beatValue, 0, 1);
			this._beatAnimFrame = requestAnimationFrame(decay);
		};

		this._beatAnimFrame = requestAnimationFrame(decay);
	}

	/**
	 * Override _setValue to include heart-rate-specific metadata
	 */
	_setValue(controlId, value, min = 0, max = 1) {
		if (!this.controls.has(controlId)) {
			this.controls.set(controlId, { type: 'value', value: 0, min, max });
		}

		const control = this.controls.get(controlId);
		control.value = value;
		control.min = min;
		control.max = max;

		this._emit('change', {
			controlId,
			value,
			control,
			type: 'sensor',
			colorSupport: 'none',
			friendlyName: controlId === 'heartrate' ? 'Heart Rate' : controlId === 'beat' ? 'Beat' : controlId
		});
	}

	disconnect() {
		if (this._beatDecayTimer) clearTimeout(this._beatDecayTimer);
		if (this._beatAnimFrame) cancelAnimationFrame(this._beatAnimFrame);
		this.heartRateDevice?.disconnect();
	}
}
