/**
 * Base MIDI Device Profile
 */
export class MIDIDeviceProfile {
	constructor(name, patterns = []) {
		this.name = name;
		this.patterns = patterns; // Array of regex patterns to match device names
		this.controls = []; // Array of control definitions (override in subclasses)
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
	 * Get control definition for a given control ID
	 * @param {string} controlId - Control ID (e.g., 'note-36', 'cc-1')
	 * @returns {{ type: string, supportsColor: boolean, friendlyName?: string, orientation?: string }}
	 */
	getControlDefinition(controlId) {
		// Look up in controls array first
		const definition = this.controls.find(c => c.controlId === controlId);
		if (definition) {
			return {
				type: definition.type,
				supportsColor: definition.supportsColor,
				friendlyName: definition.friendlyName,
				orientation: definition.orientation
			};
		}

		// Fallback to programmatic detection for generic/unknown controls
		return this._getDefaultDefinition(controlId);
	}

	/**
	 * Get default control definition based on control ID pattern
	 * Used for unknown controls not defined in the controls array
	 * @param {string} controlId - Control ID
	 * @returns {{ type: string, supportsColor: boolean }}
	 */
	_getDefaultDefinition(controlId) {
		// Generic fallback - NO color support for unknown MIDI devices
		if (controlId.startsWith('note-')) {
			return { type: 'button', supportsColor: false };
		}
		if (controlId.startsWith('cc-')) {
			return { type: 'knob', supportsColor: false };
		}
		if (controlId === 'pitchbend') {
			return { type: 'slider', supportsColor: false };
		}
		return { type: 'button', supportsColor: false };
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
