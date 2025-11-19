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
	 * Convert palette color name to MIDI command
	 * Override in subclasses for device-specific behavior
	 * @param {string} color - Palette color name
	 * @param {number} [button] - Button/note number (optional, used by SysEx devices)
	 * @returns {{ type: 'note'|'sysex', value: number|Uint8Array, note?: number, channel?: number }}
	 */
	paletteColorToCommand(color, button) {
		// Default implementation: use note velocity
		return {
			type: 'note',
			value: this.colorToVelocity(color)
		};
	}

	/**
	 * Convert color to velocity value
	 */
	colorToVelocity(color) {
		if (typeof color === 'number') return Math.max(0, Math.min(127, color));

		const velocity = this.colorMap[color];
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
