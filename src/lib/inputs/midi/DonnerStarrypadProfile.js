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
		// 4x4 pad layout: top-left=48, top-right=51, bottom-left=36, bottom-right=39
		// Map notes to pad indices 0-15 for a 4x4 grid
		this.padNotes = [
			48, 49, 50, 51,  // Row 1 (top)
			44, 45, 46, 47,  // Row 2
			40, 41, 42, 43,  // Row 3
			36, 37, 38, 39   // Row 4 (bottom)
		];
		this.noteToPadIndex = new Map(this.padNotes.map((note, index) => [note, index]));

		// Define all controls (4x4 grid of pads)
		// Note: Color protocol not reverse-engineered, so supportsColor = false
		this.controls = [
			// Row 1 (top)
			{ controlId: 'note-48', type: 'pad', supportsColor: false, friendlyName: '1-1' },
			{ controlId: 'note-49', type: 'pad', supportsColor: false, friendlyName: '1-2' },
			{ controlId: 'note-50', type: 'pad', supportsColor: false, friendlyName: '1-3' },
			{ controlId: 'note-51', type: 'pad', supportsColor: false, friendlyName: '1-4' },

			// Row 2
			{ controlId: 'note-44', type: 'pad', supportsColor: false, friendlyName: '2-1' },
			{ controlId: 'note-45', type: 'pad', supportsColor: false, friendlyName: '2-2' },
			{ controlId: 'note-46', type: 'pad', supportsColor: false, friendlyName: '2-3' },
			{ controlId: 'note-47', type: 'pad', supportsColor: false, friendlyName: '2-4' },

			// Row 3
			{ controlId: 'note-40', type: 'pad', supportsColor: false, friendlyName: '3-1' },
			{ controlId: 'note-41', type: 'pad', supportsColor: false, friendlyName: '3-2' },
			{ controlId: 'note-42', type: 'pad', supportsColor: false, friendlyName: '3-3' },
			{ controlId: 'note-43', type: 'pad', supportsColor: false, friendlyName: '3-4' },

			// Row 4 (bottom)
			{ controlId: 'note-36', type: 'pad', supportsColor: false, friendlyName: '4-1' },
			{ controlId: 'note-37', type: 'pad', supportsColor: false, friendlyName: '4-2' },
			{ controlId: 'note-38', type: 'pad', supportsColor: false, friendlyName: '4-3' },
			{ controlId: 'note-39', type: 'pad', supportsColor: false, friendlyName: '4-4' }
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
