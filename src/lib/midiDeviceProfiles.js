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
	}

	_getColorMap() {
		// LPD8 MK2 uses same velocity-based color scheme as APC mini MK2
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
