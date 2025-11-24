import { InputDevice } from './InputDevice.js';

/**
 * MIDI Input Device (WebMIDI API)
 */
export class MIDIInputDevice extends InputDevice {
	constructor(midiInput, midiOutput = null, profile = null) {
		super(midiInput.id, midiInput.name || 'MIDI Device', 'midi');
		
        this.midiInput = midiInput;
		this.midiInput.onmidimessage = this._handleMIDIMessage.bind(this);
		this.midiOutput = midiOutput; // Optional MIDI output for LED feedback
		
        this.profile = profile; // Device-specific profile for color mapping
		this.buttonColors = new Map(); // Track desired colors per note/pad
		
        this._sysexDisabled = false;
	
        /* this._registerDebugInterface(); */
	}

    /*
	_registerDebugInterface() {
		if (typeof window === 'undefined') return;
		window.WebDMX = window.WebDMX || {};
		window.WebDMX.midiDevices = window.WebDMX.midiDevices || {};

		const debugInterface = {
			id: this.id,
			name: this.name,
			hasOutput: !!this.midiOutput,
			defaultChannel: 0,
			sendNoteOn: (note, velocity, channel = 0) => this.sendNoteOn(note, velocity, channel),
			sendNoteOff: (note, channel = 0) => this.sendNoteOff(note, channel),
			sweepNote: ({
				note,
				start = 0,
				end = 127,
				channel = 0,
				interval = 200
			} = {}) => {
				if (typeof note !== 'number') {
					console.warn('[MIDI Debug] sweepNote requires a numeric note value');
					return () => {};
				}
				let current = start;
				const sendStep = () => {
					if (current > end) {
						clearInterval(timerId);
						return;
					}
					this.sendNoteOn(note, current, channel);
					console.log(`[MIDI Sweep] ${this.name}: Note ${note}, Velocity ${current}, Channel ${channel}`);
					current += 1;
				};
				sendStep();
				const timerId = setInterval(sendStep, interval);
				return () => clearInterval(timerId);
			}
		};

		window.WebDMX.midiDevices[this.id] = debugInterface;
		window.WebDMX.midiDevices[this.name] = debugInterface;
		this._debugInterfaceKeys = [this.id, this.name];
	}

	_unregisterDebugInterface() {
		if (typeof window === 'undefined') return;
		if (!this._debugInterfaceKeys) return;
		const registry = window.WebDMX?.midiDevices;
		if (!registry) return;
		for (const key of this._debugInterfaceKeys) {
			if (registry[key]) {
				delete registry[key];
			}
		}
		this._debugInterfaceKeys = null;
	}

    */

	/**
	 * Override _trigger to include control definition from profile
	 */
	_trigger(controlId, velocity = 1) {
		const definition = this.profile ? this.profile.getControlDefinition(controlId) : {};
		this._emit('trigger', {
			controlId,
			velocity,
			type: definition.type || 'button',
			colorSupport: definition.colorSupport || 'none',
			friendlyName: definition.friendlyName || null,
			orientation: definition.orientation || null
		});
	}

	/**
	 * Override _setValue to include control definition from profile
	 */
	_setValue(controlId, value, min = 0, max = 1) {
		if (!this.controls.has(controlId)) {
			this.controls.set(controlId, { type: 'value', value: 0, min, max });
		}

		const control = this.controls.get(controlId);
		control.value = value;
		control.min = min;
		control.max = max;

		const definition = this.profile ? this.profile.getControlDefinition(controlId) : {};

		// DEBUG: Log what we're getting for CC buttons
		if (controlId.startsWith('cc-') && parseInt(controlId.replace('cc-', '')) >= 100) {
			console.log('[MIDIInputDevice._setValue] DEBUG:', {
				deviceName: this.name,
				controlId,
				hasProfile: !!this.profile,
				profileName: this.profile?.name,
				definition
			});
		}

		this._emit('change', {
			controlId,
			value,
			control,
			type: definition.type || 'knob',
			colorSupport: definition.colorSupport || 'none',
			friendlyName: definition.friendlyName || null,
			orientation: definition.orientation || null
		});
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
				// Check if this CC is a button (from profile)
				const definition = this.profile ? this.profile.getControlDefinition(ccId) : null;
				if (definition && definition.type === 'button') {
					// Treat as button press/release
					if (data2 > 0) {
						this._trigger(ccId, data2 / 127);
					} else {
						this._emit('release', { controlId: ccId });
					}
				} else {
					// Treat as continuous value (knob/slider)
					this._setValue(ccId, data2 / 127, 0, 1);
				}
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
	 * Send a MIDI Program Change message
	 * @param {number} program - Program number (0-127)
	 * @param {number} channel - MIDI channel (0-15, default 0)
	 */
	sendProgramChange(program, channel = 0) {
		if (!this.midiOutput) return;
		const status = 0xc0 | (channel & 0x0f);
		this.midiOutput.send([status, program & 0x7f]);
	}

	/**
	 * Set color for a control (generic interface)
	 * @param {string} controlId - Control identifier (e.g., 'note-36')
	 * @param {string} color - Palette color name
	 */
	async setColor(controlId, color) {
		// Extract note number from control ID
		const noteMatch = controlId.match(/note-(\d+)/);
		if (!noteMatch) return;
		
		const button = parseInt(noteMatch[1]);

		// Track color state
		if (color === undefined || color === null) {
			this.buttonColors.delete(button);
		} else {
			this.buttonColors.set(button, color);
		}

		if (!this.midiOutput) return;

		// Get command from profile
		if (!this.profile || typeof this.profile.paletteColorToCommand !== 'function') {
			return;
		}

		const command = this.profile.paletteColorToCommand(color, button);
		if (!command) return;
		
		if (command.type === 'sysex') {
			// Send SysEx message
			if (!this._sysexDisabled && command.value && command.value.length > 0) {
				try {
					this.midiOutput.send(command.value);
				} catch (error) {
					if (error?.name === 'InvalidAccessError') {
						console.warn('MIDI device rejected SysEx message; disabling SysEx mode for this session.', error);
						this._sysexDisabled = true;
					} else {
						console.error('Failed to send SysEx color update:', error);
					}
				}
			}
		} else if (command.type === 'note') {
			// Send Note On message
			const note = command.note !== undefined ? command.note : button;
			const velocity = command.value;
			const channel = command.channel !== undefined ? command.channel : 0;
			
			this.sendNoteOn(note, velocity, channel);
		} else if (command.type === 'cc') {
			// Send Control Change message
			const controller = command.controller !== undefined ? command.controller : button;
			const value = command.value;
			const channel = command.channel !== undefined ? command.channel : 0;
			
			this.sendControlChange(controller, value, channel);
		} else if (command.type === 'pc') {
			// Send Program Change message
			const program = command.program;
			const channel = command.channel !== undefined ? command.channel : 0;
			
			this.sendProgramChange(program, channel);
		}
	}

	disconnect() {
		if (this.midiInput) {
			this.midiInput.onmidimessage = null;
		}
		
        /* this._unregisterDebugInterface(); */
		
        // Clear all LEDs on disconnect
		if (this.midiOutput && this.buttonColors.size > 0) {
			// Turn off each button that has a tracked color
			for (const button of this.buttonColors.keys()) {
				this.setColor(`note-${button}`, 'off');
			}
		}
		this.buttonColors.clear();
	}
}
