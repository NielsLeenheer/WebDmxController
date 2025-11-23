import { MIDIDeviceProfile } from './MIDIDeviceProfile.js';

/**
 * Donner Starrypad
 * RGB LED pads with velocity-based colors
 * 
 * Note: Color values are estimates based on similar devices.
 * May need adjustment based on actual hardware behavior.
 */
export class DonnerStarrypadProfile extends MIDIDeviceProfile {
	constructor() {
		super('Donner Starrypad', [/starrypad/i, /donner.*pad/i]);
		// 4x4 pad layout mapped by hardware numbering 1-16
		// Pad 1-4 = Row 4 (bottom), Pad 5-8 = Row 3, Pad 9-12 = Row 2, Pad 13-16 = Row 1 (top)
		this.padNotes = [
			36, 37, 38, 39,  // Pads 1-4 (Row 4 - bottom)
			40, 41, 42, 43,  // Pads 5-8 (Row 3)
			44, 45, 46, 47,  // Pads 9-12 (Row 2)
			48, 49, 50, 51   // Pads 13-16 (Row 1 - top)
		];
		this.noteToPadIndex = new Map(this.padNotes.map((note, index) => [note, index]));

		// Define all controls
		// Note: Color protocol not reverse-engineered, so colorSupport = 'none'
		this.controls = [
			// Pads - 4x4 grid (hardware numbers Pad 1-16)
			// Row 1 (top) - Pad 13-16
			{ controlId: 'note-48', type: 'pad', colorSupport: 'none', friendlyName: 'Pad 13' },
			{ controlId: 'note-49', type: 'pad', colorSupport: 'none', friendlyName: 'Pad 14' },
			{ controlId: 'note-50', type: 'pad', colorSupport: 'none', friendlyName: 'Pad 15' },
			{ controlId: 'note-51', type: 'pad', colorSupport: 'none', friendlyName: 'Pad 16' },

			// Row 2 - Pad 9-12
			{ controlId: 'note-44', type: 'pad', colorSupport: 'none', friendlyName: 'Pad 9' },
			{ controlId: 'note-45', type: 'pad', colorSupport: 'none', friendlyName: 'Pad 10' },
			{ controlId: 'note-46', type: 'pad', colorSupport: 'none', friendlyName: 'Pad 11' },
			{ controlId: 'note-47', type: 'pad', colorSupport: 'none', friendlyName: 'Pad 12' },

			// Row 3 - Pad 5-8
			{ controlId: 'note-40', type: 'pad', colorSupport: 'none', friendlyName: 'Pad 5' },
			{ controlId: 'note-41', type: 'pad', colorSupport: 'none', friendlyName: 'Pad 6' },
			{ controlId: 'note-42', type: 'pad', colorSupport: 'none', friendlyName: 'Pad 7' },
			{ controlId: 'note-43', type: 'pad', colorSupport: 'none', friendlyName: 'Pad 8' },

			// Row 4 (bottom) - Pad 1-4
			{ controlId: 'note-36', type: 'pad', colorSupport: 'none', friendlyName: 'Pad 1' },
			{ controlId: 'note-37', type: 'pad', colorSupport: 'none', friendlyName: 'Pad 2' },
			{ controlId: 'note-38', type: 'pad', colorSupport: 'none', friendlyName: 'Pad 3' },
			{ controlId: 'note-39', type: 'pad', colorSupport: 'none', friendlyName: 'Pad 4' },

			// Faders (vertical sliders)
			{ controlId: 'cc-20', type: 'fader', colorSupport: 'none', friendlyName: 'F1' },
			{ controlId: 'cc-21', type: 'fader', colorSupport: 'none', friendlyName: 'F2' },

			// Knobs
			{ controlId: 'cc-28', type: 'knob', colorSupport: 'none', friendlyName: 'K1' },
			{ controlId: 'cc-9', type: 'knob', colorSupport: 'none', friendlyName: 'K2' },

			// Buttons
			{ controlId: 'cc-26', type: 'button', colorSupport: 'none', friendlyName: 'A' },
			{ controlId: 'cc-27', type: 'button', colorSupport: 'none', friendlyName: 'B' },
			{ controlId: 'cc-60', type: 'button', colorSupport: 'none', friendlyName: 'Play/Pause' },
			{ controlId: 'cc-62', type: 'button', colorSupport: 'none', friendlyName: 'Record' }
		];
	}

	_getColorMap() {
		// According to Donner's documentation the Starrypad encodes LED colors
		// via standard Note On velocity values. Each group of four velocities
		// represents a color family (0 = off, 1-3 = white, 4-7 = red, etc.).
		// The values below pick representative codes from each range so we can
		// address the full palette without relying on SysEx.
		return {
			'off': 0,
			'black': 0,

			'white-dim': 1,
			'white': 2,
			'white-bright': 3,

			'red-dim': 4,
			'red': 5,
			'red-bright': 6,

			'orange': 9,
			'orange-bright': 10,

			'yellow': 13,
			'yellow-bright': 14,

			'lime': 17,
			'green': 21,
			'spring': 25,

			'turquoise': 27,
			'cyan': 31,

			'sky': 34,
			'blue': 37,

			'violet': 41,
			'purple': 44,

			'magenta': 50,
			'pink': 54
		};
	}

	paletteColorToCommand(color, button) {
		// TODO: Donner Starrypad uses a proprietary MIDI protocol for LED control
		// that we haven't been able to reverse engineer. Common protocols tried:
		// - SysEx (Akai, Generic, Novation formats)
		// - Note On, Control Change, Program Change messages
		// 
		// To implement color support, we would need:
		// 1. Official Donner Starrypad MIDI documentation
		// 2. Or capture MIDI messages from official Donner software
		//
		// For now, return undefined to indicate no color command available
		return undefined;
	}
}
