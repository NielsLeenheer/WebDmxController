import { MIDIDeviceProfile } from './MIDIDeviceProfile.js';

/**
 * Akai Professional APC mini MK2
 * RGB LED pads with extensive color palette
 */
export class APCMiniMK2Profile extends MIDIDeviceProfile {
	constructor() {
		super('APC mini MK2', [/apc\s*mini\s*mk2?/i, /apc\s*mini\s*2/i]);

		// Define all controls
		this.controls = [
			// 8x8 grid of pads (notes 0-63) - all support color
			{ controlId: 'note-0', type: 'pad', supportsColor: true, friendlyName: 'Pad 1-1' },
			{ controlId: 'note-1', type: 'pad', supportsColor: true, friendlyName: 'Pad 1-2' },
			{ controlId: 'note-2', type: 'pad', supportsColor: true, friendlyName: 'Pad 1-3' },
			{ controlId: 'note-3', type: 'pad', supportsColor: true, friendlyName: 'Pad 1-4' },
			{ controlId: 'note-4', type: 'pad', supportsColor: true, friendlyName: 'Pad 1-5' },
			{ controlId: 'note-5', type: 'pad', supportsColor: true, friendlyName: 'Pad 1-6' },
			{ controlId: 'note-6', type: 'pad', supportsColor: true, friendlyName: 'Pad 1-7' },
			{ controlId: 'note-7', type: 'pad', supportsColor: true, friendlyName: 'Pad 1-8' },

			{ controlId: 'note-8', type: 'pad', supportsColor: true, friendlyName: 'Pad 2-1' },
			{ controlId: 'note-9', type: 'pad', supportsColor: true, friendlyName: 'Pad 2-2' },
			{ controlId: 'note-10', type: 'pad', supportsColor: true, friendlyName: 'Pad 2-3' },
			{ controlId: 'note-11', type: 'pad', supportsColor: true, friendlyName: 'Pad 2-4' },
			{ controlId: 'note-12', type: 'pad', supportsColor: true, friendlyName: 'Pad 2-5' },
			{ controlId: 'note-13', type: 'pad', supportsColor: true, friendlyName: 'Pad 2-6' },
			{ controlId: 'note-14', type: 'pad', supportsColor: true, friendlyName: 'Pad 2-7' },
			{ controlId: 'note-15', type: 'pad', supportsColor: true, friendlyName: 'Pad 2-8' },

			{ controlId: 'note-16', type: 'pad', supportsColor: true, friendlyName: 'Pad 3-1' },
			{ controlId: 'note-17', type: 'pad', supportsColor: true, friendlyName: 'Pad 3-2' },
			{ controlId: 'note-18', type: 'pad', supportsColor: true, friendlyName: 'Pad 3-3' },
			{ controlId: 'note-19', type: 'pad', supportsColor: true, friendlyName: 'Pad 3-4' },
			{ controlId: 'note-20', type: 'pad', supportsColor: true, friendlyName: 'Pad 3-5' },
			{ controlId: 'note-21', type: 'pad', supportsColor: true, friendlyName: 'Pad 3-6' },
			{ controlId: 'note-22', type: 'pad', supportsColor: true, friendlyName: 'Pad 3-7' },
			{ controlId: 'note-23', type: 'pad', supportsColor: true, friendlyName: 'Pad 3-8' },

			{ controlId: 'note-24', type: 'pad', supportsColor: true, friendlyName: 'Pad 4-1' },
			{ controlId: 'note-25', type: 'pad', supportsColor: true, friendlyName: 'Pad 4-2' },
			{ controlId: 'note-26', type: 'pad', supportsColor: true, friendlyName: 'Pad 4-3' },
			{ controlId: 'note-27', type: 'pad', supportsColor: true, friendlyName: 'Pad 4-4' },
			{ controlId: 'note-28', type: 'pad', supportsColor: true, friendlyName: 'Pad 4-5' },
			{ controlId: 'note-29', type: 'pad', supportsColor: true, friendlyName: 'Pad 4-6' },
			{ controlId: 'note-30', type: 'pad', supportsColor: true, friendlyName: 'Pad 4-7' },
			{ controlId: 'note-31', type: 'pad', supportsColor: true, friendlyName: 'Pad 4-8' },

			{ controlId: 'note-32', type: 'pad', supportsColor: true, friendlyName: 'Pad 5-1' },
			{ controlId: 'note-33', type: 'pad', supportsColor: true, friendlyName: 'Pad 5-2' },
			{ controlId: 'note-34', type: 'pad', supportsColor: true, friendlyName: 'Pad 5-3' },
			{ controlId: 'note-35', type: 'pad', supportsColor: true, friendlyName: 'Pad 5-4' },
			{ controlId: 'note-36', type: 'pad', supportsColor: true, friendlyName: 'Pad 5-5' },
			{ controlId: 'note-37', type: 'pad', supportsColor: true, friendlyName: 'Pad 5-6' },
			{ controlId: 'note-38', type: 'pad', supportsColor: true, friendlyName: 'Pad 5-7' },
			{ controlId: 'note-39', type: 'pad', supportsColor: true, friendlyName: 'Pad 5-8' },

			{ controlId: 'note-40', type: 'pad', supportsColor: true, friendlyName: 'Pad 6-1' },
			{ controlId: 'note-41', type: 'pad', supportsColor: true, friendlyName: 'Pad 6-2' },
			{ controlId: 'note-42', type: 'pad', supportsColor: true, friendlyName: 'Pad 6-3' },
			{ controlId: 'note-43', type: 'pad', supportsColor: true, friendlyName: 'Pad 6-4' },
			{ controlId: 'note-44', type: 'pad', supportsColor: true, friendlyName: 'Pad 6-5' },
			{ controlId: 'note-45', type: 'pad', supportsColor: true, friendlyName: 'Pad 6-6' },
			{ controlId: 'note-46', type: 'pad', supportsColor: true, friendlyName: 'Pad 6-7' },
			{ controlId: 'note-47', type: 'pad', supportsColor: true, friendlyName: 'Pad 6-8' },

			{ controlId: 'note-48', type: 'pad', supportsColor: true, friendlyName: 'Pad 7-1' },
			{ controlId: 'note-49', type: 'pad', supportsColor: true, friendlyName: 'Pad 7-2' },
			{ controlId: 'note-50', type: 'pad', supportsColor: true, friendlyName: 'Pad 7-3' },
			{ controlId: 'note-51', type: 'pad', supportsColor: true, friendlyName: 'Pad 7-4' },
			{ controlId: 'note-52', type: 'pad', supportsColor: true, friendlyName: 'Pad 7-5' },
			{ controlId: 'note-53', type: 'pad', supportsColor: true, friendlyName: 'Pad 7-6' },
			{ controlId: 'note-54', type: 'pad', supportsColor: true, friendlyName: 'Pad 7-7' },
			{ controlId: 'note-55', type: 'pad', supportsColor: true, friendlyName: 'Pad 7-8' },

			{ controlId: 'note-56', type: 'pad', supportsColor: true, friendlyName: 'Pad 8-1' },
			{ controlId: 'note-57', type: 'pad', supportsColor: true, friendlyName: 'Pad 8-2' },
			{ controlId: 'note-58', type: 'pad', supportsColor: true, friendlyName: 'Pad 8-3' },
			{ controlId: 'note-59', type: 'pad', supportsColor: true, friendlyName: 'Pad 8-4' },
			{ controlId: 'note-60', type: 'pad', supportsColor: true, friendlyName: 'Pad 8-5' },
			{ controlId: 'note-61', type: 'pad', supportsColor: true, friendlyName: 'Pad 8-6' },
			{ controlId: 'note-62', type: 'pad', supportsColor: true, friendlyName: 'Pad 8-7' },
			{ controlId: 'note-63', type: 'pad', supportsColor: true, friendlyName: 'Pad 8-8' },

			// Scene launch buttons (notes 82-89) - support color
			{ controlId: 'note-82', type: 'button', supportsColor: true, friendlyName: 'Scene 1' },
			{ controlId: 'note-83', type: 'button', supportsColor: true, friendlyName: 'Scene 2' },
			{ controlId: 'note-84', type: 'button', supportsColor: true, friendlyName: 'Scene 3' },
			{ controlId: 'note-85', type: 'button', supportsColor: true, friendlyName: 'Scene 4' },
			{ controlId: 'note-86', type: 'button', supportsColor: true, friendlyName: 'Scene 5' },
			{ controlId: 'note-87', type: 'button', supportsColor: true, friendlyName: 'Scene 6' },
			{ controlId: 'note-88', type: 'button', supportsColor: true, friendlyName: 'Scene 7' },
			{ controlId: 'note-89', type: 'button', supportsColor: true, friendlyName: 'Scene 8' },

			// Faders (CC 48-56) - no color support
			{ controlId: 'cc-48', type: 'slider', supportsColor: false, friendlyName: 'Fader 1' },
			{ controlId: 'cc-49', type: 'slider', supportsColor: false, friendlyName: 'Fader 2' },
			{ controlId: 'cc-50', type: 'slider', supportsColor: false, friendlyName: 'Fader 3' },
			{ controlId: 'cc-51', type: 'slider', supportsColor: false, friendlyName: 'Fader 4' },
			{ controlId: 'cc-52', type: 'slider', supportsColor: false, friendlyName: 'Fader 5' },
			{ controlId: 'cc-53', type: 'slider', supportsColor: false, friendlyName: 'Fader 6' },
			{ controlId: 'cc-54', type: 'slider', supportsColor: false, friendlyName: 'Fader 7' },
			{ controlId: 'cc-55', type: 'slider', supportsColor: false, friendlyName: 'Fader 8' },
			{ controlId: 'cc-56', type: 'slider', supportsColor: false, friendlyName: 'Fader 9' },

			// Control buttons - support color
			{ controlId: 'cc-100', type: 'button', supportsColor: true, friendlyName: 'Volume' },
			{ controlId: 'cc-101', type: 'button', supportsColor: true, friendlyName: 'Pan' },
			{ controlId: 'cc-102', type: 'button', supportsColor: true, friendlyName: 'Send' },
			{ controlId: 'cc-103', type: 'button', supportsColor: true, friendlyName: 'Device' },
			{ controlId: 'cc-104', type: 'button', supportsColor: true, friendlyName: 'Up' },
			{ controlId: 'cc-105', type: 'button', supportsColor: true, friendlyName: 'Down' },
			{ controlId: 'cc-106', type: 'button', supportsColor: true, friendlyName: 'Left' },
			{ controlId: 'cc-107', type: 'button', supportsColor: true, friendlyName: 'Right' },
			{ controlId: 'cc-112', type: 'button', supportsColor: true, friendlyName: 'Clip Stop' },
			{ controlId: 'cc-113', type: 'button', supportsColor: true, friendlyName: 'Solo' },
			{ controlId: 'cc-114', type: 'button', supportsColor: true, friendlyName: 'Mute' },
			{ controlId: 'cc-115', type: 'button', supportsColor: true, friendlyName: 'Rec Arm' },
			{ controlId: 'cc-116', type: 'button', supportsColor: true, friendlyName: 'Select' },
			{ controlId: 'cc-117', type: 'button', supportsColor: true, friendlyName: 'Drum' },
			{ controlId: 'cc-118', type: 'button', supportsColor: true, friendlyName: 'Note' },
			{ controlId: 'cc-119', type: 'button', supportsColor: true, friendlyName: 'Stop All Clips' },
			{ controlId: 'cc-122', type: 'button', supportsColor: true, friendlyName: 'Shift' }
		];
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
