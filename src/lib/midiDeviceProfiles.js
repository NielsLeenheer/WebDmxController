/**
 * MIDI Device Profiles
 *
 * Device-specific color mappings and configurations for MIDI controllers
 * with LED feedback. Each profile defines how colors map to MIDI velocity values.
 */

/**
 * Base MIDI Device Profile
 */
export class MIDIDeviceProfile {
	constructor(name, patterns = []) {
		this.name = name;
		this.patterns = patterns; // Array of regex patterns to match device names
		this.colorMap = this._getColorMap();
		this.colorUpdateMode = this._getColorUpdateMode(); // 'note' | 'sysex'
	}

	/**
	 * Check if this profile matches a device name
	 */
	matches(deviceName) {
		const lowerName = deviceName.toLowerCase();
		return this.patterns.some(pattern => pattern.test(lowerName));
	}

	/**
	 * Convert color to velocity value
	 */
	colorToVelocity(color) {
		if (typeof color === 'number') return Math.max(0, Math.min(127, color));

		const velocity = this.colorMap[color.toLowerCase()];
		return velocity !== undefined ? velocity : 0;
	}

	/**
	 * Convert color to RGB (override for RGB/SysEx devices)
	 */
	colorToRGB(color) {
		if (!color) {
			return { r: 0, g: 0, b: 0 };
		}

		if (typeof color === 'object' && color !== null) {
			return {
				r: Math.max(0, Math.min(127, color.r || 0)),
				g: Math.max(0, Math.min(127, color.g || 0)),
				b: Math.max(0, Math.min(127, color.b || 0))
			};
		}

		// Default implementation only supports named colors in colorMap
		const velocity = this.colorToVelocity(color);
		return {
			r: velocity,
			g: velocity,
			b: velocity
		};
	}

	/**
	 * Override to change how button colors should be sent
	 */
	_getColorUpdateMode() {
		return 'note';
	}

	/**
	 * Provide note/channel/velocity for devices that use NOTE ON velocity colors
	 */
	getNoteColor(button, color) {
		return {
			note: button,
			velocity: this.colorToVelocity(color),
			channel: 0
		};
	}

	/**
	 * Provide SysEx message for devices that need full RGB updates
	 */
	buildColorSysEx(/* buttonColors */) {
		return null;
	}

	/**
	 * Get color map (override in subclasses)
	 */
	_getColorMap() {
		return {
			'off': 0,
			'red': 5,
			'green': 21,
			'blue': 45,
			'yellow': 13,
			'orange': 9,
			'cyan': 37,
			'purple': 53,
			'pink': 57,
			'white': 3
		};
	}
}

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

/**
 * Akai LPD8
 * Note: LPD8 has limited LED feedback - mainly red LEDs
 */
export class AkaiLPD8Profile extends MIDIDeviceProfile {
	constructor() {
		super('Akai LPD8', [/lpd\s*8/i, /lpd8/i]);
	}

	_getColorMap() {
		// LPD8 has simple red LEDs - on/off only
		return {
			'off': 0,
			'red': 127,
			'on': 127,
			// Map all colors to red
			'green': 127,
			'blue': 127,
			'yellow': 127,
			'orange': 127,
			'cyan': 127,
			'purple': 127,
			'pink': 127,
			'white': 127
		};
	}
}

/**
 * Akai LPD8 MK2
 * RGB LED pads with full color support
 */
export class AkaiLPD8MK2Profile extends MIDIDeviceProfile {
	constructor() {
		super('Akai LPD8 MK2', [/lpd\s*8\s*mk\s*2/i, /lpd8\s*mk2/i, /lpd8.*wireless.*2/i]);
		this.padNotes = [36, 37, 38, 39, 40, 41, 42, 43];
		this.noteToPadIndex = new Map(this.padNotes.map((note, index) => [note, index]));
		this._rgbColorMap = this._getRGBColorMap();
		this.deviceId = 0x7f; // Broadcast to all devices by default
	}

	_getColorUpdateMode() {
		return 'sysex';
	}

	_getColorMap() {
		// Maintain compatibility for any velocity-based fallbacks
		return {
			'off': 0,
			'black': 0
		};
	}

	_getRGBColorMap() {
		const max = 127;
		const mid = 63;
		const dim = 31;
		return {
			'off': { r: 0, g: 0, b: 0 },
			'black': { r: 0, g: 0, b: 0 },
			'gray': { r: mid, g: mid, b: mid },
			'grey': { r: mid, g: mid, b: mid },
			'white': { r: max, g: max, b: max },
			'red': { r: max, g: 0, b: 0 },
			'red-dim': { r: dim, g: 0, b: 0 },
			'red-half': { r: mid, g: 0, b: 0 },
			'red-bright': { r: max, g: dim, b: dim },
			'orange': { r: max, g: mid, b: 0 },
			'orange-dim': { r: mid, g: dim, b: 0 },
			'orange-half': { r: mid, g: mid, b: 0 },
			'orange-bright': { r: max, g: mid, b: dim },
			'yellow': { r: max, g: max, b: 0 },
			'yellow-dim': { r: mid, g: mid, b: 0 },
			'yellow-half': { r: max, g: mid, b: 0 },
			'yellow-bright': { r: max, g: max, b: dim },
			'lime': { r: mid, g: max, b: 0 },
			'lime-dim': { r: dim, g: mid, b: 0 },
			'lime-half': { r: mid, g: mid, b: 0 },
			'lime-bright': { r: mid, g: max, b: dim },
			'green': { r: 0, g: max, b: 0 },
			'green-dim': { r: 0, g: dim, b: 0 },
			'green-half': { r: 0, g: mid, b: 0 },
			'green-bright': { r: dim, g: max, b: dim },
			'spring': { r: 0, g: max, b: mid },
			'spring-dim': { r: 0, g: dim, b: dim },
			'spring-half': { r: 0, g: mid, b: mid },
			'spring-bright': { r: dim, g: max, b: mid },
			'turquoise': { r: 0, g: mid, b: max },
			'turquoise-dim': { r: 0, g: dim, b: mid },
			'turquoise-half': { r: 0, g: mid, b: mid },
			'turquoise-bright': { r: dim, g: mid, b: max },
			'cyan': { r: 0, g: max, b: max },
			'cyan-dim': { r: 0, g: dim, b: dim },
			'cyan-half': { r: 0, g: mid, b: mid },
			'cyan-bright': { r: dim, g: max, b: max },
			'sky': { r: 0, g: mid, b: max },
			'sky-dim': { r: 0, g: dim, b: mid },
			'sky-half': { r: 0, g: mid, b: mid },
			'sky-bright': { r: dim, g: mid, b: max },
			'blue': { r: 0, g: 0, b: max },
			'blue-dim': { r: 0, g: 0, b: dim },
			'blue-half': { r: 0, g: 0, b: mid },
			'blue-bright': { r: dim, g: dim, b: max },
			'violet': { r: mid, g: 0, b: max },
			'violet-dim': { r: dim, g: 0, b: dim },
			'violet-half': { r: mid, g: 0, b: mid },
			'violet-bright': { r: max, g: dim, b: max },
			'purple': { r: max, g: 0, b: max },
			'purple-dim': { r: dim, g: 0, b: dim },
			'purple-half': { r: mid, g: 0, b: mid },
			'purple-bright': { r: max, g: dim, b: max },
			'magenta': { r: max, g: 0, b: mid },
			'magenta-dim': { r: dim, g: 0, b: dim },
			'magenta-half': { r: mid, g: 0, b: mid },
			'magenta-bright': { r: max, g: mid, b: max },
			'pink': { r: max, g: mid, b: mid },
			'pink-dim': { r: mid, g: dim, b: dim },
			'pink-half': { r: mid, g: mid, b: mid },
			'pink-bright': { r: max, g: mid, b: max }
		};
	}

	colorToRGB(color) {
		if (!color) return { r: 0, g: 0, b: 0 };
		if (typeof color === 'object' && color !== null) return color;
		if (typeof color === 'number') {
			const value = Math.max(0, Math.min(127, color));
			return { r: value, g: value, b: value };
		}

		if (typeof color === 'string') {
			const key = color.toLowerCase();
			if (this._rgbColorMap[key]) {
				return this._rgbColorMap[key];
			}

			const hexMatch = key.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
			if (hexMatch) {
				return this._hexToRGB(hexMatch[1]);
			}

			const rgbMatch = key.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
			if (rgbMatch) {
				return {
					r: parseInt(rgbMatch[1], 10),
					g: parseInt(rgbMatch[2], 10),
					b: parseInt(rgbMatch[3], 10)
				};
			}
		}

		return { r: 0, g: 0, b: 0 };
	}

	buildColorSysEx(buttonColors) {
		const payload = [];
		for (let padIndex = 0; padIndex < this.padNotes.length; padIndex++) {
			const note = this.padNotes[padIndex];
			const color = buttonColors.get(note) || 'off';
			const rgb = this._normalizeRGB(this.colorToRGB(color));
			payload.push(...this._encodeColor(rgb));
		}

		return [
			0xf0,
			0x47,
			this.deviceId & 0x7f,
			0x4c,
			0x06,
			0x00,
			0x30,
			...payload,
			0xf7
		];
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

	_hexToRGB(hex) {
		if (hex.length === 3) {
			return {
				r: parseInt(hex[0] + hex[0], 16),
				g: parseInt(hex[1] + hex[1], 16),
				b: parseInt(hex[2] + hex[2], 16)
			};
		}

		return {
			r: parseInt(hex.substring(0, 2), 16),
			g: parseInt(hex.substring(2, 4), 16),
			b: parseInt(hex.substring(4, 6), 16)
		};
	}
}

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

/**
 * Device Profile Manager
 * Automatically matches MIDI devices to their profiles
 */
export class MIDIDeviceProfileManager {
	constructor() {
		this.profiles = [
			new APCMiniMK2Profile(),
			new AkaiLPD8MK2Profile(), // Check MK2 first before falling back to original LPD8
			new AkaiLPD8Profile(),
			new DonnerStarrypadProfile()
		];
	}

	/**
	 * Get profile for a device name
	 */
	getProfile(deviceName) {
		for (const profile of this.profiles) {
			if (profile.matches(deviceName)) {
				return profile;
			}
		}
		// Return generic profile if no match
		return new MIDIDeviceProfile('Generic MIDI Device');
	}

	/**
	 * Add a custom profile
	 */
	addProfile(profile) {
		this.profiles.unshift(profile); // Add at beginning for priority
	}
}
