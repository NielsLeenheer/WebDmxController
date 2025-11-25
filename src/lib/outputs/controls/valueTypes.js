/**
 * Control Value Types
 *
 * Defines metadata for control value types including CSS properties, ranges, and units.
 * Used for value-based triggers to enable automatic type conversion.
 */

/**
 * Control value type definitions
 * Each type defines the CSS property, range, and unit for a control channel
 */
export const CONTROL_VALUE_TYPES = {
	// Pan control (-50% to +50%)
	pan: {
		cssProperty: '--pan',
		min: -50,
		max: 50,
		unit: '%',
		dmxMin: 0,
		dmxMax: 255,
		description: 'Pan position (-50% to +50%)'
	},

	// Tilt control (0% to 100%)
	tilt: {
		cssProperty: '--tilt',
		min: 0,
		max: 100,
		unit: '%',
		dmxMin: 0,
		dmxMax: 255,
		description: 'Tilt position (0% to 100%)'
	},

	// Intensity/Dimmer (0 to 1, unitless for opacity)
	intensity: {
		cssProperty: '--intensity',
		min: 0,
		max: 1,
		unit: '',
		dmxMin: 0,
		dmxMax: 255,
		description: 'Intensity/Dimmer (0 to 1)'
	},

	// White channel (0% to 100%)
	white: {
		cssProperty: '--white',
		min: 0,
		max: 100,
		unit: '%',
		dmxMin: 0,
		dmxMax: 255,
		description: 'White intensity (0% to 100%)'
	},

	// Amber channel (0% to 100%)
	amber: {
		cssProperty: '--amber',
		min: 0,
		max: 100,
		unit: '%',
		dmxMin: 0,
		dmxMax: 255,
		description: 'Amber intensity (0% to 100%)'
	},

	// Generic percentage slider (0% to 100%)
	percentageSlider: {
		cssProperty: null, // Will be derived from control name
		min: 0,
		max: 100,
		unit: '%',
		dmxMin: 0,
		dmxMax: 255,
		description: 'Generic slider (0% to 100%)'
	},

	// RGB Red channel (0-255)
	red: {
		cssProperty: null, // Part of color property
		min: 0,
		max: 255,
		unit: '',
		dmxMin: 0,
		dmxMax: 255,
		description: 'Red channel (0-255)'
	},

	// RGB Green channel (0-255)
	green: {
		cssProperty: null, // Part of color property
		min: 0,
		max: 255,
		unit: '',
		dmxMin: 0,
		dmxMax: 255,
		description: 'Green channel (0-255)'
	},

	// RGB Blue channel (0-255)
	blue: {
		cssProperty: null, // Part of color property
		min: 0,
		max: 255,
		unit: '',
		dmxMin: 0,
		dmxMax: 255,
		description: 'Blue channel (0-255)'
	},

	// Safety toggle (discrete: none/probably)
	safety: {
		cssProperty: '--safety',
		min: 0,
		max: 255,
		unit: '',
		dmxMin: 0,
		dmxMax: 255,
		isToggle: true,
		description: 'Safety switch (on/off)'
	},

	// Flame control (0% to 100%)
	flame: {
		cssProperty: '--flame',
		min: 0,
		max: 100,
		unit: '%',
		dmxMin: 0,
		dmxMax: 255,
		description: 'Flame intensity (0% to 100%)'
	},

	// Smoke control (0% to 100%)
	smoke: {
		cssProperty: '--smoke',
		min: 0,
		max: 100,
		unit: '%',
		dmxMin: 0,
		dmxMax: 255,
		description: 'Smoke output (0% to 100%)'
	},

	// Strobe control (0-255 raw)
	strobe: {
		cssProperty: '--strobe',
		min: 0,
		max: 255,
		unit: '',
		dmxMin: 0,
		dmxMax: 255,
		description: 'Strobe speed (0-255)'
	},

	// Speed control (0-255 raw)
	speed: {
		cssProperty: '--speed',
		min: 0,
		max: 255,
		unit: '',
		dmxMin: 0,
		dmxMax: 255,
		description: 'Speed (0-255)'
	}
};

/**
 * Get value metadata for a control type and optional channel
 * @param {Object} controlType - Control type instance
 * @param {string} controlName - Name of the control (e.g., 'Dimmer', 'Pan/Tilt')
 * @param {string|null} channel - Channel name for multi-channel controls ('pan', 'tilt', 'r', 'g', 'b')
 * @returns {Object|null} Value metadata
 */
export function getControlValueMetadata(controlType, controlName, channel = null) {
	const typeId = controlType.type;

	// XY Pad controls (Pan/Tilt)
	if (typeId === 'xypad') {
		if (channel === 'pan' || channel === 'x') {
			return { ...CONTROL_VALUE_TYPES.pan, channel: 'x' };
		}
		if (channel === 'tilt' || channel === 'y') {
			return { ...CONTROL_VALUE_TYPES.tilt, channel: 'y' };
		}
		// Return both channels if no specific channel requested
		return {
			channels: [
				{ ...CONTROL_VALUE_TYPES.pan, channel: 'x', key: 'pan' },
				{ ...CONTROL_VALUE_TYPES.tilt, channel: 'y', key: 'tilt' }
			]
		};
	}

	// RGB controls
	if (typeId === 'rgb') {
		if (channel === 'r' || channel === 'red') {
			return { ...CONTROL_VALUE_TYPES.red, channel: 'r' };
		}
		if (channel === 'g' || channel === 'green') {
			return { ...CONTROL_VALUE_TYPES.green, channel: 'g' };
		}
		if (channel === 'b' || channel === 'blue') {
			return { ...CONTROL_VALUE_TYPES.blue, channel: 'b' };
		}
		// Return all channels if no specific channel requested
		return {
			channels: [
				{ ...CONTROL_VALUE_TYPES.red, channel: 'r', key: 'red' },
				{ ...CONTROL_VALUE_TYPES.green, channel: 'g', key: 'green' },
				{ ...CONTROL_VALUE_TYPES.blue, channel: 'b', key: 'blue' }
			]
		};
	}

	// Slider controls (Dimmer, White, Amber, etc.)
	if (typeId === 'slider') {
		const nameLower = controlName.toLowerCase();

		if (nameLower === 'dimmer' || nameLower === 'intensity') {
			return { ...CONTROL_VALUE_TYPES.intensity };
		}
		if (nameLower === 'white') {
			return { ...CONTROL_VALUE_TYPES.white };
		}
		if (nameLower === 'amber') {
			return { ...CONTROL_VALUE_TYPES.amber };
		}
		if (nameLower === 'flame') {
			return { ...CONTROL_VALUE_TYPES.flame };
		}
		if (nameLower === 'smoke') {
			return { ...CONTROL_VALUE_TYPES.smoke };
		}
		if (nameLower === 'strobe') {
			return { ...CONTROL_VALUE_TYPES.strobe };
		}
		if (nameLower === 'speed') {
			return { ...CONTROL_VALUE_TYPES.speed };
		}

		// Generic slider - derive CSS property from control name
		return {
			...CONTROL_VALUE_TYPES.percentageSlider,
			cssProperty: `--${nameLower.replace(/\s+/g, '-')}`
		};
	}

	// Toggle controls
	if (typeId === 'toggle') {
		const nameLower = controlName.toLowerCase();
		if (nameLower === 'safety') {
			return { ...CONTROL_VALUE_TYPES.safety };
		}
		// Generic toggle
		return {
			cssProperty: `--${nameLower.replace(/\s+/g, '-')}`,
			min: 0,
			max: 255,
			unit: '',
			dmxMin: 0,
			dmxMax: 255,
			isToggle: true,
			description: `${controlName} (on/off)`
		};
	}

	return null;
}

/**
 * Get available channels for a control type
 * @param {Object} controlType - Control type instance
 * @returns {Array} Array of channel definitions
 */
export function getControlChannels(controlType) {
	const typeId = controlType.type;

	if (typeId === 'xypad') {
		return [
			{ key: 'pan', label: 'Pan (X)', channel: 'x' },
			{ key: 'tilt', label: 'Tilt (Y)', channel: 'y' }
		];
	}

	if (typeId === 'rgb') {
		return [
			{ key: 'red', label: 'Red', channel: 'r' },
			{ key: 'green', label: 'Green', channel: 'g' },
			{ key: 'blue', label: 'Blue', channel: 'b' }
		];
	}

	// Single-channel controls
	return [{ key: 'value', label: 'Value', channel: null }];
}
