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
