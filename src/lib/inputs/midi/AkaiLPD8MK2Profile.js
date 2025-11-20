import { MIDIDeviceProfile } from './MIDIDeviceProfile.js';
import { paletteColorToRGB } from '../colors.js';

/**
 * Akai LPD8 MK2
 * RGB LED pads with full color support
 */
export class AkaiLPD8MK2Profile extends MIDIDeviceProfile {
	constructor() {
		super('Akai LPD8 MK2', [/lpd\s*8\s*mk\s*2/i, /lpd8\s*mk2/i, /lpd8.*wireless.*2/i]);
		this.padNotes = [36, 37, 38, 39, 40, 41, 42, 43];
		this.noteToPadIndex = new Map(this.padNotes.map((note, index) => [note, index]));
		this.deviceId = 0x7f; // Broadcast to all devices by default

		// Track current color state for all pads
		// The Akai LPD8 MK2 requires all pad colors to be sent in a single SysEx message
		this.padColors = new Map(); // note -> color name
		// Initialize all pads to black
		for (const note of this.padNotes) {
			this.padColors.set(note, 'black');
		}
	}

	/**
	 * Update a single pad color in internal state
	 * Does NOT send to hardware - call flushColors() to send
	 * @param {number} note - MIDI note number of the pad
	 * @param {string} color - Palette color name
	 */
	setPadColor(note, color) {
		const padIndex = this.noteToPadIndex.get(note);
		if (padIndex !== undefined) {
			this.padColors.set(note, color);
		}
	}

	/**
	 * Build and return SysEx command with current state of ALL pads
	 * @returns {{ type: 'sysex', value: Uint8Array }}
	 */
	flushColors() {
		// Build SysEx message with ALL pad colors
		const payload = [];
		for (const padNote of this.padNotes) {
			const padColor = this.padColors.get(padNote) || 'black';
			const rgb = paletteColorToRGB(padColor);
			const normalized = this._normalizeRGB(rgb);
			const encoded = this._encodeColor(normalized);
			payload.push(...encoded);
		}

		const sysex = new Uint8Array([
			0xf0,
			0x47,
			this.deviceId & 0x7f,
			0x4c,
			0x06,
			0x00,
			0x30,
			...payload,
			0xf7
		]);

		return { type: 'sysex', value: sysex };
	}

	/**
	 * Convert palette color to SysEx command
	 * Updates internal state and returns a SysEx message with ALL pad colors
	 * (Akai LPD8 MK2 requires all pads to be updated at once)
	 * @param {string} color - Palette color name
	 * @param {number} note - MIDI note number of the pad
	 * @returns {{ type: 'sysex', value: Uint8Array }}
	 */
	paletteColorToCommand(color, note) {
		const padIndex = this.noteToPadIndex.get(note);
		if (padIndex === undefined) {
			// Unknown pad, no command
			return;
		}

		// Update internal state for this pad
		this.setPadColor(note, color);

		// Return SysEx with all colors
		return this.flushColors();
	}

	_encodeColor({ r, g, b }) {
		const encodeChannel = (value) => {
			const clamped = Math.max(0, Math.min(127, value));
			return [(clamped >> 7) & 0x7f, clamped & 0x7f];
		};

		return [...encodeChannel(r), ...encodeChannel(g), ...encodeChannel(b)];
	}

	_normalizeRGB({ r, g, b }) {
		const clamp = (value) => Math.max(0, Math.min(255, value));
		return {
			r: Math.round((clamp(r) / 255) * 127),
			g: Math.round((clamp(g) / 255) * 127),
			b: Math.round((clamp(b) / 255) * 127)
		};
	}
}
