/**
 * Control Value Converters
 *
 * Utilities for converting between control-based values and DMX arrays.
 * These functions form the boundary between the application's semantic
 * control values and the DMX protocol's channel arrays.
 */

/**
 * Convert device control values to DMX array
 *
 * Takes a device type definition and a control values object,
 * returns a DMX array ready for output.
 *
 * @param {DeviceType} deviceType - Device type definition (class instance)
 * @param {Object} controlValues - Control values object { "Color": { r, g, b }, "Dimmer": 255, ... }
 * @returns {Array<number>} DMX array (0-255 values)
 *
 * @example
 * const deviceType = DEVICE_TYPES.RGB;
 * const controlValues = { "Color": { r: 255, g: 128, b: 64 } };
 * const dmx = controlValuesToDMX(deviceType, controlValues);
 * // Returns: [255, 128, 64]
 */
export function controlValuesToDMX(deviceType, controlValues) {
	// Start with device default values (all channels)
	const dmxArray = [...deviceType.defaultValues];

	// Process each control defined in the device type
	for (const controlDef of deviceType.controls) {
		const value = controlValues?.[controlDef.name];
		if (value === undefined) {
			// Control not set, use default from dmxArray
			continue;
		}

		// Get DMX values from control type
		// Input: plain object/number, Output: plain array
		const controlDMX = controlDef.type.valueToDMX(value);

		// Write to correct channels
		for (let i = 0; i < controlDMX.length; i++) {
			dmxArray[controlDef.startChannel + i] = controlDMX[i];
		}
	}

	return dmxArray;
}

/**
 * Convert DMX array to device control values
 *
 * Takes a device type definition and a DMX array,
 * returns a control values object.
 *
 * @param {DeviceType} deviceType - Device type definition (class instance)
 * @param {Array<number>} dmxArray - DMX array (0-255 values)
 * @returns {Object} Control values object { "Color": { r, g, b }, "Dimmer": 255, ... }
 *
 * @example
 * const deviceType = DEVICE_TYPES.RGB;
 * const dmx = [255, 128, 64];
 * const controlValues = dmxToControlValues(deviceType, dmx);
 * // Returns: { "Color": { r: 255, g: 128, b: 64 } }
 */
export function dmxToControlValues(deviceType, dmxArray) {
	const controlValues = {};

	// Process each control defined in the device type
	for (const controlDef of deviceType.controls) {
		// Extract DMX values for this control (plain array slice)
		const controlDMX = dmxArray.slice(
			controlDef.startChannel,
			controlDef.startChannel + controlDef.type.getChannelCount()
		);

		// Convert to control value
		// Input: plain array, Output: plain object/number
		controlValues[controlDef.name] = controlDef.type.dmxToValue(controlDMX);
	}

	return controlValues;
}

/**
 * Create default control values for a device type
 *
 * Returns a control values object with all controls set to their defaults.
 * This is useful when creating new devices or resetting values.
 *
 * @param {DeviceType} deviceType - Device type definition (class instance)
 * @returns {Object} Control values object with defaults
 *
 * @example
 * const deviceType = DEVICE_TYPES.MOVING_HEAD;
 * const defaults = createDefaultControlValues(deviceType);
 * // Returns: {
 * //   "Pan/Tilt": { x: 128, y: 128 },
 * //   "Dimmer": 255,
 * //   "Color": { r: 0, g: 0, b: 0 },
 * //   ...
 * // }
 */
export function createDefaultControlValues(deviceType) {
	const controlValues = {};

	for (const controlDef of deviceType.controls) {
		// Get default value from control type
		controlValues[controlDef.name] = controlDef.type.getDefaultValue();
	}

	return controlValues;
}

/**
 * Merge control values from source to target
 *
 * Copies control values from source to target, but only for controls
 * that exist in the target device type. Useful for device linking.
 *
 * @param {Object} sourceValues - Source control values
 * @param {Object} targetValues - Target control values (will be modified)
 * @param {Array<string>} controlNames - Names of controls to merge (optional, default: all common)
 * @returns {Object} Updated target values
 *
 * @example
 * const source = { "Color": { r: 255, g: 0, b: 0 }, "Dimmer": 200 };
 * const target = { "Color": { r: 0, g: 0, b: 0 }, "Dimmer": 255 };
 * mergeControlValues(source, target, ["Color"]);
 * // target is now: { "Color": { r: 255, g: 0, b: 0 }, "Dimmer": 255 }
 */
export function mergeControlValues(sourceValues, targetValues, controlNames = null) {
	// If no control names specified, merge all controls that exist in both
	const controlsToMerge = controlNames ?? Object.keys(sourceValues).filter(
		name => name in targetValues
	);

	for (const controlName of controlsToMerge) {
		if (sourceValues[controlName] !== undefined) {
			// Deep copy the value to avoid reference sharing
			const value = sourceValues[controlName];
			if (typeof value === 'object' && value !== null) {
				targetValues[controlName] = { ...value };
			} else {
				targetValues[controlName] = value;
			}
		}
	}

	return targetValues;
}

/**
 * Apply mirror transformation to Pan/Tilt control
 *
 * Mirrors the X (pan) value: 255 - x
 * This is useful for linked devices facing opposite directions.
 *
 * @param {Object} controlValue - Pan/Tilt control value { x, y }
 * @returns {Object} Mirrored control value { x: 255-x, y }
 *
 * @example
 * mirrorPanTilt({ x: 200, y: 100 })
 * // Returns: { x: 55, y: 100 }
 */
export function mirrorPanTilt(controlValue) {
	if (controlValue && typeof controlValue === 'object' && 'x' in controlValue) {
		return {
			...controlValue,
			x: 255 - controlValue.x
		};
	}
	return controlValue;
}
