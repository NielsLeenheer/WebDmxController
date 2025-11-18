import { MIDIDeviceProfile } from './MIDIDeviceProfile.js';

/**
 * Akai Professional APC mini MK2
 * RGB LED pads with extensive color palette
 */
export class APCMiniMK2Profile extends MIDIDeviceProfile {
	constructor() {
		super('APC mini MK2', [/apc\s*mini\s*mk2?/i, /apc\s*mini\s*2/i]);
	}

	_getColorMap() {
		// APC mini MK2 uses velocity values for colors
		// Reference: https://www.akaipro.com/apc-mini-mk2
		return {
			'off': 0,
			'black': 0,

			// Grayscale
			'gray': 1,
			'grey': 1,
			'white': 3,

			// Reds
			'red': 5,
			'red-dim': 6,
			'red-half': 7,
			'red-bright': 8,

			// Oranges
			'orange': 9,
			'orange-dim': 10,
			'orange-half': 11,
			'orange-bright': 12,

			// Yellows
			'yellow': 13,
			'yellow-dim': 14,
			'yellow-half': 15,
			'yellow-bright': 16,

			// Limes
			'lime': 17,
			'lime-dim': 18,
			'lime-half': 19,
			'lime-bright': 20,

			// Greens
			'green': 21,
			'green-dim': 22,
			'green-half': 23,
			'green-bright': 24,

			// Springs
			'spring': 25,
			'spring-dim': 26,
			'spring-half': 27,
			'spring-bright': 28,

			// Turquoise
			'turquoise': 29,
			'turquoise-dim': 30,
			'turquoise-half': 31,
			'turquoise-bright': 32,

			// Cyans
			'cyan': 33,
			'cyan-dim': 34,
			'cyan-half': 35,
			'cyan-bright': 36,

			// Sky Blues
			'sky': 37,
			'sky-dim': 38,
			'sky-half': 39,
			'sky-bright': 40,

			// Blues
			'blue': 41,
			'blue-dim': 42,
			'blue-half': 43,
			'blue-bright': 44,

			// Violets
			'violet': 45,
			'violet-dim': 46,
			'violet-half': 47,
			'violet-bright': 48,

			// Purples
			'purple': 49,
			'purple-dim': 50,
			'purple-half': 51,
			'purple-bright': 52,

			// Magentas
			'magenta': 53,
			'magenta-dim': 54,
			'magenta-half': 55,
			'magenta-bright': 56,

			// Pinks
			'pink': 57,
			'pink-dim': 58,
			'pink-half': 59,
			'pink-bright': 60
		};
	}
}
