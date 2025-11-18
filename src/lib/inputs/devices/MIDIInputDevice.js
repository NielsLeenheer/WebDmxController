import { InputDevice } from './InputDevice.js';

/**
 * MIDI Input Device (WebMIDI API)
 */
export class MIDIInputDevice extends InputDevice {
	constructor(midiInput, midiOutput = null, profile = null) {
		super(midiInput.id, midiInput.name || 'MIDI Device', 'midi');
		this.midiInput = midiInput;
		this.midiOutput = midiOutput; // Optional MIDI output for LED feedback
		this.profile = profile; // Device-specific profile for color mapping
		this.buttonColors = new Map(); // Track desired colors per note/pad
		this._sysexDisabled = false;
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

	/**
	 * Send a MIDI Note On message (used for setting button LED colors)
	 * @param {number} note - Note number (0-127)
	 * @param {number} velocity - Velocity/color (0-127)
	 * @param {number} channel - MIDI channel (0-15, default 0)
	 */
	sendNoteOn(note, velocity, channel = 0) {
		if (!this.midiOutput) return;
		const status = 0x90 | (channel & 0x0f);
		this.midiOutput.send([status, note & 0x7f, velocity & 0x7f]);
	}

	/**
	 * Send a MIDI Note Off message
	 * @param {number} note - Note number (0-127)
	 * @param {number} channel - MIDI channel (0-15, default 0)
	 */
	sendNoteOff(note, channel = 0) {
		if (!this.midiOutput) return;
		const status = 0x80 | (channel & 0x0f);
		this.midiOutput.send([status, note & 0x7f, 0]);
	}

	/**
	 * Send a MIDI Control Change message
	 * @param {number} controller - Controller number (0-127)
	 * @param {number} value - Controller value (0-127)
	 * @param {number} channel - MIDI channel (0-15, default 0)
	 */
	sendControlChange(controller, value, channel = 0) {
		if (!this.midiOutput) return;
		const status = 0xb0 | (channel & 0x0f);
		this.midiOutput.send([status, controller & 0x7f, value & 0x7f]);
	}

	/**
	 * Set button color (device-agnostic, will use device profile)
	 * @param {number} button - Button/pad number
	 * @param {string|number} color - Color name or velocity value
	 */
	setButtonColor(button, color) {
		if (color === undefined || color === null) {
			this.buttonColors.delete(button);
		} else {
			this.buttonColors.set(button, color);
		}

		if (!this.midiOutput) return;

		const mode = this.profile?.colorUpdateMode || 'note';

		if (
			mode === 'sysex' &&
			!this._sysexDisabled &&
			typeof this.profile?.buildColorSysEx === 'function'
		) {
			const message = this.profile.buildColorSysEx(this.buttonColors);
			if (message && message.length) {
				try {
					this.midiOutput.send(message);
					return;
				} catch (error) {
					if (error?.name === 'InvalidAccessError') {
						console.warn('MIDI device rejected SysEx message; disabling SysEx mode for this session.', error);
						this._sysexDisabled = true;
					} else {
						console.error('Failed to send SysEx color update:', error);
					}
				}
			}
		}

		// Default to velocity-based color via NOTE ON
		const noteData = typeof this.profile?.getNoteColor === 'function'
			? this.profile.getNoteColor(button, color)
			: { note: button, velocity: this._colorToVelocity(color), channel: 0 };

		if (!noteData) return;

		const {
			note = button,
			velocity = this._colorToVelocity(color),
			channel = 0
		} = noteData;

		this.sendNoteOn(note, velocity, channel);
	}

	/**
	 * Convert color to velocity value (device-specific)
	 * Uses device profile if available
	 */
	_colorToVelocity(color) {
		// Use profile if available
		if (this.profile) {
			return this.profile.colorToVelocity(color);
		}

		// Fallback to basic mapping
		if (typeof color === 'number') return Math.max(0, Math.min(127, color));

		const colorMap = {
			'off': 0,
			'red': 5,
			'orange': 9,
			'yellow': 13,
			'green': 21,
			'cyan': 37,
			'blue': 45,
			'purple': 53,
			'pink': 57,
			'white': 3
		};

		return colorMap[color.toLowerCase()] || 0;
	}

	disconnect() {
		if (this.midiInput) {
			this.midiInput.onmidimessage = null;
		}
		// Clear all LEDs on disconnect
		if (this.midiOutput) {
			const mode = this.profile?.colorUpdateMode || 'note';
			if (
				mode === 'sysex' &&
				!this._sysexDisabled &&
				typeof this.profile?.buildColorSysEx === 'function'
			) {
				this.buttonColors.clear();
				const message = this.profile.buildColorSysEx(this.buttonColors);
				if (message && message.length) {
					try {
						this.midiOutput.send(message);
					} catch (error) {
						console.warn('Failed to send SysEx clear message on disconnect.', error);
						this._sysexDisabled = true;
					}
				}
			} else {
				for (let i = 0; i < 128; i++) {
					this.sendNoteOff(i);
				}
			}
		}
		this.buttonColors.clear();
	}
}
