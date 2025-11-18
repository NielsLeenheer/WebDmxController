import { MIDIDeviceProfile } from './MIDIDeviceProfile.js';

/**
 * Donner Starrypad
 * RGB LED pads
 */
export class DonnerStarrypadProfile extends MIDIDeviceProfile {
	constructor() {
		super('Donner Starrypad', [/starrypad/i, /donner.*pad/i]);
	}

	_getColorMap() {
		// Starrypad uses velocity for colors
		// Based on similar budget MIDI pad controllers
		return {
			'off': 0,
			'black': 0,

			// Basic colors
			'red': 1,
			'red-dim': 2,
			'red-bright': 3,

			'orange': 4,
			'orange-dim': 5,
			'orange-bright': 6,

			'yellow': 7,
			'yellow-dim': 8,
			'yellow-bright': 9,

			'green': 10,
			'green-dim': 11,
			'green-bright': 12,

			'cyan': 13,
			'cyan-dim': 14,
			'cyan-bright': 15,

			'blue': 16,
			'blue-dim': 17,
			'blue-bright': 18,

			'purple': 19,
			'purple-dim': 20,
			'purple-bright': 21,

			'pink': 22,
			'pink-dim': 23,
			'pink-bright': 24,

			'white': 25,
			'white-dim': 26,
			'white-bright': 27
		};
	}
}
