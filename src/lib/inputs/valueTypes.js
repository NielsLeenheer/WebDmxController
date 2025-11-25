/**
 * Input Value Types
 *
 * Defines metadata for input value types including ranges, units, and CSS format.
 * Used for value-based triggers to enable automatic type conversion.
 */

/**
 * Input value type definitions
 * Each type defines the range and format of input values
 */
export const INPUT_VALUE_TYPES = {
	// Percentage (0-100%) - used by most slider/knob inputs
	percentage: {
		min: 0,
		max: 100,
		unit: '%',
		cssFormat: 'percentage',
		description: 'Percentage value (0-100%)'
	},

	// Degrees (-180 to 180) - used by Thingy euler angles
	degrees: {
		min: -180,
		max: 180,
		unit: 'deg',
		cssFormat: 'angle',
		description: 'Angle in degrees (-180° to 180°)'
	},

	// Degrees for pan (gravity-compensated, -180 to 180)
	panDegrees: {
		min: -180,
		max: 180,
		unit: 'deg',
		cssFormat: 'angle',
		description: 'Pan angle in degrees (-180° to 180°)'
	},

	// Degrees for tilt (gravity-compensated, -90 to 90)
	tiltDegrees: {
		min: -90,
		max: 90,
		unit: 'deg',
		cssFormat: 'angle',
		description: 'Tilt angle in degrees (-90° to 90°)'
	},

	// Quaternion component (-1 to 1)
	quaternion: {
		min: -1,
		max: 1,
		unit: '',
		cssFormat: 'number',
		description: 'Quaternion component (-1 to 1)'
	},

	// Acceleration in g (-4 to 4)
	acceleration: {
		min: -4,
		max: 4,
		unit: 'g',
		cssFormat: 'number',
		description: 'Acceleration in g (-4g to 4g)'
	},

	// Gyroscope in deg/s (-2000 to 2000)
	gyroscope: {
		min: -2000,
		max: 2000,
		unit: 'deg',
		cssFormat: 'angle',
		description: 'Angular velocity in deg/s (-2000 to 2000)'
	},

	// Compass in µT (-100 to 100)
	compass: {
		min: -100,
		max: 100,
		unit: '',
		cssFormat: 'number',
		description: 'Magnetic field in µT (-100 to 100)'
	},

	// Normalized 0-1 range (raw MIDI CC before percentage conversion)
	normalized: {
		min: 0,
		max: 1,
		unit: '',
		cssFormat: 'number',
		description: 'Normalized value (0 to 1)'
	}
};

/**
 * Get the exported values for an input based on its type
 * @param {Object} input - Input object from InputLibrary
 * @returns {Array} Array of exported value definitions
 */
export function getInputExportedValues(input) {
	const values = [];

	// Determine input type
	const inputType = input.type || 'knob';
	const inputControlId = input.inputControlId || '';

	// Button/Pad inputs export pressure (velocity)
	if (['button', 'pad'].includes(inputType)) {
		// Buttons export pressure on press (normalized velocity as percentage)
		values.push({
			key: 'pressure',
			label: 'Pressure',
			cssProperty: input.cssProperty ? `${input.cssProperty}-pressure` : null,
			valueType: 'percentage',
			description: 'Button/pad pressure (velocity)'
		});
	}

	// Knob/Slider inputs export their value
	if (['knob', 'slider'].includes(inputType) || !['button', 'pad'].includes(inputType)) {
		// Check if this is a Thingy sensor
		if (inputControlId.startsWith('euler-')) {
			values.push({
				key: 'value',
				label: 'Angle',
				cssProperty: input.cssProperty,
				valueType: 'degrees',
				description: 'Euler angle in degrees'
			});
		} else if (inputControlId === 'pan') {
			values.push({
				key: 'value',
				label: 'Pan',
				cssProperty: input.cssProperty,
				valueType: 'panDegrees',
				description: 'Pan angle in degrees'
			});
		} else if (inputControlId === 'tilt') {
			values.push({
				key: 'value',
				label: 'Tilt',
				cssProperty: input.cssProperty,
				valueType: 'tiltDegrees',
				description: 'Tilt angle in degrees'
			});
		} else if (inputControlId.startsWith('quat-')) {
			values.push({
				key: 'value',
				label: 'Quaternion',
				cssProperty: input.cssProperty,
				valueType: 'quaternion',
				description: 'Quaternion component'
			});
		} else if (inputControlId.startsWith('accel-')) {
			values.push({
				key: 'value',
				label: 'Acceleration',
				cssProperty: input.cssProperty,
				valueType: 'acceleration',
				description: 'Acceleration in g'
			});
		} else if (inputControlId.startsWith('gyro-')) {
			values.push({
				key: 'value',
				label: 'Angular Velocity',
				cssProperty: input.cssProperty,
				valueType: 'gyroscope',
				description: 'Angular velocity in deg/s'
			});
		} else if (inputControlId.startsWith('compass-')) {
			values.push({
				key: 'value',
				label: 'Magnetic Field',
				cssProperty: input.cssProperty,
				valueType: 'compass',
				description: 'Magnetic field in µT'
			});
		} else {
			// Default: percentage (standard MIDI CC, slider, knob)
			values.push({
				key: 'value',
				label: 'Value',
				cssProperty: input.cssProperty,
				valueType: 'percentage',
				description: 'Input value as percentage'
			});
		}
	}

	// Sensors can also export raw normalized value
	if (inputControlId.includes('thingy') ||
		inputControlId.startsWith('euler-') ||
		inputControlId.startsWith('quat-') ||
		inputControlId.startsWith('accel-') ||
		inputControlId.startsWith('gyro-') ||
		inputControlId.startsWith('compass-')) {
		// These are already covered above based on controlId
	}

	return values;
}

/**
 * Get the value type metadata for a given type ID
 * @param {string} typeId - Value type identifier
 * @returns {Object|null} Value type metadata
 */
export function getValueType(typeId) {
	return INPUT_VALUE_TYPES[typeId] || null;
}
