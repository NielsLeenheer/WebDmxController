/**
 * Input System
 *
 * Utility functions for working with input controls (buttons, sliders, knobs) from MIDI/HID devices
 */

import { toCSSIdentifier } from '../css/utils.js';
import { getInputTypeForInput } from './types/index.js';

/**
 * Check if an input has button functionality
 * Uses InputType to determine this based on the input's type field
 * @param {Object} input - Input object
 * @returns {boolean}
 */
export function isButtonInput(input) {
	// If input has a type field, use InputType to determine
	if (input.type) {
		const inputType = getInputTypeForInput(input);
		return inputType.isButton();
	}

	// Fallback for inputs without type field - detect from controlId
	if (!input.inputControlId) return false;
	return input.inputControlId.startsWith('note-') ||
	       input.inputControlId.startsWith('button-') ||
	       input.inputControlId === 'button' ||
	       input.inputControlId.startsWith('key-');
}

/**
 * Check if an input has continuous values (sensors, sliders, knobs)
 * Uses InputType to determine this based on the input's type field
 * @param {Object} input - Input object
 * @returns {boolean}
 */
export function isContinuousInput(input) {
	// If input has a type field, use InputType to determine
	if (input.type) {
		const inputType = getInputTypeForInput(input);
		return inputType.isContinuous();
	}

	// Fallback - CC controls and sensors are continuous
	if (!input.inputControlId) return false;
	return input.inputControlId.startsWith('cc-') ||
	       input.inputControlId.startsWith('euler-') ||
	       input.inputControlId.startsWith('quat-') ||
	       input.inputControlId.startsWith('accel-') ||
	       input.inputControlId.startsWith('gyro-') ||
	       input.inputControlId.startsWith('compass-') ||
	       input.inputControlId === 'pan' ||
	       input.inputControlId === 'tilt';
}

/**
 * Get CSS property name for an input (for sliders/knobs)
 * @param {Object} input - Input object
 * @returns {string}
 */
export function getInputPropertyName(input) {
	return input.cssProperty || `--${toCSSIdentifier(input.name)}`;
}
