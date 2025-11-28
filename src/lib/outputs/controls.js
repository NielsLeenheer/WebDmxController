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
 * @param {Object} controlValues - Control values object { "color": { red, green, blue }, "dimmer": 255, ... }
 * @returns {Array<number>} DMX array (0-255 values)
 *
 * @example
 * const deviceType = DEVICE_TYPES.RGB;
 * const controlValues = { "color": { red: 255, green: 128, blue: 64 } };
 * const dmx = controlValuesToDMX(deviceType, controlValues);
 * // Returns: [255, 128, 64]
 */
export function controlValuesToDMX(deviceType, controlValues) {
	// Start with device default values (all channels)
	const dmxArray = [...deviceType.defaultValues];

	// Process each control defined in the device type
	for (const controlDef of deviceType.controls) {
		const value = controlValues?.[controlDef.id];
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
 * @returns {Object} Control values object { "color": { red, green, blue }, "dimmer": 255, ... }
 *
 * @example
 * const deviceType = DEVICE_TYPES['rgb'];
 * const dmx = [255, 128, 64];
 * const controlValues = dmxToControlValues(deviceType, dmx);
 * // Returns: { "color": { red: 255, green: 128, blue: 64 } }
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
		controlValues[controlDef.id] = controlDef.type.dmxToValue(controlDMX);
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
 * const deviceType = DEVICE_TYPES['moving-head'];
 * const defaults = createDefaultControlValues(deviceType);
 * // Returns: {
 * //   "pantilt": { pan: 128, tilt: 128 },
 * //   "dimmer": 255,
 * //   "color": { red: 0, green: 0, blue: 0 },
 * //   ...
 * // }
 */
export function createDefaultControlValues(deviceType) {
	const controlValues = {};

	for (const controlDef of deviceType.controls) {
		controlValues[controlDef.id] = controlDef.type.getDefaultValue();
	}

	return controlValues;
}

/**
 * Apply mirror transformation to Pan/Tilt control
 *
 * Mirrors the X (pan) value: 255 - x
 * This is useful for linked devices facing opposite directions.
 *
 * @param {Object} controlValue - Pan/Tilt control value { pan, tilt }
 * @returns {Object} Mirrored control value { pan: 255-pan, tilt }
 *
 * @example
 * mirrorPanTilt({ pan: 200, tilt: 100 })
 * // Returns: { pan: 55, tilt: 100 }
 */
export function mirrorPanTilt(controlValue) {
	if (controlValue && typeof controlValue === 'object' && 'pan' in controlValue) {
		return {
			...controlValue,
			pan: 255 - controlValue.pan
		};
	}
	return controlValue;
}
