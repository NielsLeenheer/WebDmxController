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
export function isButton(input) {
	// If input has a type field, use InputType to determine
	if (input.type) {
		const inputType = getInputTypeForInput(input);
		return inputType.isButton();
	}

	// Fallback for inputs without type field - detect from controlId
	if (!input.controlId) return false;
	return input.controlId.startsWith('note-') ||
	       input.controlId.startsWith('button-') ||
	       input.controlId === 'button' ||
	       input.controlId.startsWith('key-');
}

/**
 * Check if an input has exportable values (sensors, sliders, knobs, pads)
 * Uses InputType to determine this based on the input's type field
 * @param {Object} input - Input object
 * @returns {boolean}
 */
export function hasValues(input) {
	// If input has a type field, use InputType to determine
	if (input.type) {
		const inputType = getInputTypeForInput(input);
		return inputType.hasValues();
	}

	// Fallback - CC controls and sensors have values
	if (!input.controlId) return false;
	return input.controlId.startsWith('cc-') ||
	       input.controlId.startsWith('euler-') ||
	       input.controlId.startsWith('quat-') ||
	       input.controlId.startsWith('accel-') ||
	       input.controlId.startsWith('gyro-') ||
	       input.controlId.startsWith('compass-') ||
	       input.controlId === 'pan' ||
	       input.controlId === 'tilt';
}

/**
 * Get CSS property name for an input (for sliders/knobs)
 * @param {Object} input - Input object
 * @returns {string}
 */
export function getInputPropertyName(input) {
	return `--${input.cssIdentifier || toCSSIdentifier(input.name)}`;
}
