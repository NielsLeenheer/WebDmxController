import { InputDevice } from './InputDevice.js';

/**
 * Audio Input Device
 *
 * Uses getUserMedia + WebAudio AnalyserNode to detect beats/energy
 * in frequency bands. Emits trigger/release events on detected hits
 * and continuous energy values per band.
 *
 * Frequency bands:
 *   sub-bass   :  20–60 Hz   (kick drums, deep bass)
 *   bass       :  60–250 Hz  (bass guitar, toms)
 *   low-mid    : 250–500 Hz  (warmth, body)
 *   mid        : 500–2000 Hz (vocals, snare)
 *   high-mid   : 2k–4 kHz   (presence, hi-hat)
 *   high       : 4k–16 kHz  (brilliance, cymbals)
 *
 * Each band exposes:
 *   - energy  : 0–1 smoothed RMS energy (continuous, for CSS)
 *   - trigger : fires when energy exceeds adaptive threshold (beat detection)
 *
 * Also exposes:
 *   - volume  : overall 0–1 level
 */

// Default frequency band definitions (lo/hi in Hz)
const DEFAULT_BANDS = [
	{ id: 'bass', label: 'Bass', lo: 20,   hi: 250  },
	{ id: 'mid',  label: 'Mid',  lo: 250,  hi: 4000 },
	{ id: 'high', label: 'High', lo: 4000, hi: 16000 },
];

// Per-band slider constraints
const BAND_LIMITS = [
	{ minLo: 20,   maxHi: 500   },  // bass: 20–500 Hz
	{ minLo: 100,  maxHi: 8000  },  // mid: 100–8000 Hz
	{ minLo: 2000, maxHi: 20000 },  // high: 2k–20k Hz
];

// Beat detection constants
const HISTORY_LENGTH = 86;     // ~2 seconds of flux history
const DEFAULT_SENSITIVITY = 1.0; // Flux must exceed median + sensitivity × stddev
const BEAT_COOLDOWN_MS = 200;  // Min time between beats per band (~300 BPM max)
const BEAT_HOLD_MS = 20;       // Min time a beat trigger stays active
const ENERGY_SMOOTH = 0.3;     // Smoothing factor for energy output (0 = none, 1 = frozen)
const ENERGY_GATE = 0.10;      // Minimum band energy to consider beat detection
const FLUX_SMOOTH = 0.15;      // Smoothing for flux signal (reduces jitter)

export class AudioInputDevice extends InputDevice {
	constructor(stream) {
		super('audio', 'Microphone', 'audio');

		this._stream = stream;
		this._audioCtx = null;
		this._analyser = null;
		this._source = null;
		this._freqData = null;
		this._rafId = null;

		// Per-band configuration (lo, hi, sensitivity) and state
		this._bands = DEFAULT_BANDS.map(b => ({
			id: b.id,
			label: b.label,
			lo: b.lo,
			hi: b.hi,
			sensitivity: DEFAULT_SENSITIVITY,
		}));

		this._bandState = this._bands.map(() => ({
			fluxHistory: new Float32Array(HISTORY_LENGTH),
			histIdx: 0,
			histFull: false,
			smoothEnergy: 0,
			prevEnergy: 0,
			smoothFlux: 0,
			lastBeatTime: 0,
		}));

		this._smoothVolume = 0;

		this._initAudio();
	}

	/** Get current band configurations */
	get bands() { return this._bands; }

	/** Get serializable audio settings (bands + source) */
	getAudioSettings() {
		return {
			bands: this._bands.map(b => ({ lo: b.lo, hi: b.hi, sensitivity: b.sensitivity })),
		};
	}

	/** Apply previously saved audio settings */
	applyAudioSettings(settings) {
		if (!settings?.bands) return;
		for (let i = 0; i < Math.min(settings.bands.length, this._bands.length); i++) {
			const saved = settings.bands[i];
			if (saved.lo !== undefined) this._bands[i].lo = saved.lo;
			if (saved.hi !== undefined) this._bands[i].hi = saved.hi;
			if (saved.sensitivity !== undefined) this._bands[i].sensitivity = saved.sensitivity;
		}
	}

	/**
	 * Update a band's parameters at runtime.
	 * @param {number} index Band index (0=bass, 1=mid, 2=high)
	 * @param {object} params Partial params: { lo, hi, sensitivity }
	 */
	configureBand(index, params) {
		const band = this._bands[index];
		if (!band) return;
		if (params.lo !== undefined) band.lo = params.lo;
		if (params.hi !== undefined) band.hi = params.hi;
		if (params.sensitivity !== undefined) band.sensitivity = params.sensitivity;
	}

	_initAudio() {
		this._audioCtx = new AudioContext();
		this._source = this._audioCtx.createMediaStreamSource(this._stream);

		this._analyser = this._audioCtx.createAnalyser();
		this._analyser.fftSize = 2048;
		this._analyser.smoothingTimeConstant = 0.5;

		this._source.connect(this._analyser);
		// Do NOT connect to destination — we don't want to play back mic audio

		this._freqData = new Uint8Array(this._analyser.frequencyBinCount);

		this._tick = this._tick.bind(this);
		this._rafId = requestAnimationFrame(this._tick);
	}

	/** @returns {AnalyserNode|null} The Web Audio analyser node for live FFT access */
	get analyser() { return this._analyser; }

	/** @returns {number} Sample rate of the audio context */
	get sampleRate() { return this._audioCtx?.sampleRate ?? 44100; }

	/**
	 * Convert a frequency (Hz) to the corresponding FFT bin index
	 */
	_freqToBin(freq) {
		const nyquist = this._audioCtx.sampleRate / 2;
		const binCount = this._analyser.frequencyBinCount;
		return Math.round((freq / nyquist) * binCount);
	}

	/**
	 * Compute RMS energy for a frequency range from the FFT data
	 */
	_bandEnergy(lo, hi) {
		const binLo = Math.max(0, this._freqToBin(lo));
		const binHi = Math.min(this._freqData.length - 1, this._freqToBin(hi));
		if (binHi <= binLo) return 0;

		let sum = 0;
		for (let i = binLo; i <= binHi; i++) {
			const v = this._freqData[i] / 255;
			sum += v * v;
		}
		return Math.sqrt(sum / (binHi - binLo + 1));
	}

	_tick() {
		this._rafId = requestAnimationFrame(this._tick);
		this._analyser.getByteFrequencyData(this._freqData);

		const now = performance.now();
		let totalEnergy = 0;

		for (let b = 0; b < this._bands.length; b++) {
			const band = this._bands[b];
			const state = this._bandState[b];
			const energy = this._bandEnergy(band.lo, band.hi);

			// Onset flux: positive change in energy (detects attacks/transients)
			const rawFlux = Math.max(0, energy - state.prevEnergy);
			state.prevEnergy = energy;

			// Smooth the flux to reduce jitter from noise
			state.smoothFlux = FLUX_SMOOTH * state.smoothFlux + (1 - FLUX_SMOOTH) * rawFlux;
			const flux = state.smoothFlux;

			// Update flux history ring buffer
			state.fluxHistory[state.histIdx] = flux;
			state.histIdx = (state.histIdx + 1) % HISTORY_LENGTH;
			if (state.histIdx === 0) state.histFull = true;

			// Compute median and standard deviation of flux history
			const len = state.histFull ? HISTORY_LENGTH : state.histIdx;
			const sorted = state.fluxHistory.slice(0, len).sort();
			const median = len > 0 ? sorted[Math.floor(len / 2)] : 0;

			let variance = 0;
			for (let i = 0; i < len; i++) {
				const d = state.fluxHistory[i] - median;
				variance += d * d;
			}
			const stddev = len > 1 ? Math.sqrt(variance / len) : 0;

			// Smoothed energy for CSS output
			state.smoothEnergy = ENERGY_SMOOTH * state.smoothEnergy + (1 - ENERGY_SMOOTH) * energy;

			// Emit energy as continuous value
			this._setValue(band.id, state.smoothEnergy);

			// Beat detection: flux spike above (median + sensitivity·stddev), gated by minimum energy
			const threshold = median + band.sensitivity * stddev;
			if (energy > ENERGY_GATE && flux > threshold && (now - state.lastBeatTime) > BEAT_COOLDOWN_MS) {
				state.lastBeatTime = now;
				this._emit('trigger', {
					controlId: band.id,
					velocity: Math.min(1, flux / Math.max(threshold, 0.01)),
					type: 'button',
					colorSupport: 'none',
					friendlyName: band.label
				});
				this._emit('release', { controlId: band.id });
			}

			totalEnergy += energy;
		}

		// Overall volume
		const volume = totalEnergy / this._bands.length;
		this._smoothVolume = ENERGY_SMOOTH * this._smoothVolume + (1 - ENERGY_SMOOTH) * volume;
		this._setValue('volume', this._smoothVolume);
	}

	disconnect() {
		if (this._rafId) {
			cancelAnimationFrame(this._rafId);
			this._rafId = null;
		}
		if (this._source) {
			this._source.disconnect();
			this._source = null;
		}
		if (this._audioCtx) {
			this._audioCtx.close();
			this._audioCtx = null;
		}
		if (this._stream) {
			for (const track of this._stream.getTracks()) {
				track.stop();
			}
			this._stream = null;
		}
	}
}

/** Exported band definitions for use by AudioInputType */
export const AUDIO_BANDS = DEFAULT_BANDS.map(b => ({
	id: b.id,
	label: b.label,
	lo: b.lo,
	hi: b.hi,
}));

export { DEFAULT_BANDS, BAND_LIMITS };
