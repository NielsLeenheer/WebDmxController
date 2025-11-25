/**
 * Input Value Types
 *
 * Utility functions for getting input value metadata.
 * Value types are defined inline based on input control IDs.
 */

/**
 * Get the exported values for an input based on its type and control ID
 * @param {Object} input - Input object from InputLibrary
 * @returns {Array} Array of exported value definitions with inline metadata
 */
export function getInputExportedValues(input) {
	const values = [];
	const inputType = input.type || 'knob';
	const inputControlId = input.inputControlId || '';

	// Button/Pad inputs export pressure (velocity)
	if (['button', 'pad'].includes(inputType)) {
		values.push({
			key: 'pressure',
			label: 'Pressure',
			cssProperty: input.cssProperty ? `${input.cssProperty}-pressure` : null,
			// Inline value type metadata
			min: 0,
			max: 100,
			unit: '%',
			description: 'Button/pad pressure (velocity)'
		});
	}

	// Knob/Slider/Sensor inputs export their value
	if (['knob', 'slider'].includes(inputType) || !['button', 'pad'].includes(inputType)) {
		// Thingy:52 Euler angles (-180 to 180 degrees)
		if (inputControlId.startsWith('euler-')) {
			values.push({
				key: 'value',
				label: 'Angle',
				cssProperty: input.cssProperty,
				min: -180,
				max: 180,
				unit: 'deg',
				description: 'Euler angle in degrees (-180° to 180°)'
			});
		}
		// Thingy:52 Pan (gravity-compensated, -180 to 180)
		else if (inputControlId === 'pan') {
			values.push({
				key: 'value',
				label: 'Pan',
				cssProperty: input.cssProperty,
				min: -180,
				max: 180,
				unit: 'deg',
				description: 'Pan angle in degrees (-180° to 180°)'
			});
		}
		// Thingy:52 Tilt (gravity-compensated, -90 to 90)
		else if (inputControlId === 'tilt') {
			values.push({
				key: 'value',
				label: 'Tilt',
				cssProperty: input.cssProperty,
				min: -90,
				max: 90,
				unit: 'deg',
				description: 'Tilt angle in degrees (-90° to 90°)'
			});
		}
		// Thingy:52 Quaternion components (-1 to 1)
		else if (inputControlId.startsWith('quat-')) {
			values.push({
				key: 'value',
				label: 'Quaternion',
				cssProperty: input.cssProperty,
				min: -1,
				max: 1,
				unit: '',
				description: 'Quaternion component (-1 to 1)'
			});
		}
		// Thingy:52 Accelerometer (-4g to 4g)
		else if (inputControlId.startsWith('accel-')) {
			values.push({
				key: 'value',
				label: 'Acceleration',
				cssProperty: input.cssProperty,
				min: -4,
				max: 4,
				unit: 'g',
				description: 'Acceleration in g (-4g to 4g)'
			});
		}
		// Thingy:52 Gyroscope (-2000 to 2000 deg/s)
		else if (inputControlId.startsWith('gyro-')) {
			values.push({
				key: 'value',
				label: 'Angular Velocity',
				cssProperty: input.cssProperty,
				min: -2000,
				max: 2000,
				unit: 'deg',
				description: 'Angular velocity in deg/s (-2000 to 2000)'
			});
		}
		// Thingy:52 Compass (-100 to 100 µT)
		else if (inputControlId.startsWith('compass-')) {
			values.push({
				key: 'value',
				label: 'Magnetic Field',
				cssProperty: input.cssProperty,
				min: -100,
				max: 100,
				unit: '',
				description: 'Magnetic field in µT (-100 to 100)'
			});
		}
		// Default: percentage (0-100%) - standard MIDI CC, slider, knob
		else {
			values.push({
				key: 'value',
				label: 'Value',
				cssProperty: input.cssProperty,
				min: 0,
				max: 100,
				unit: '%',
				description: 'Input value as percentage (0-100%)'
			});
		}
	}

	return values;
}
