/**
 * Input Value Types
 *
 * Utility functions for getting input value metadata.
 * Uses input type classes to determine exported values.
 */

import { getInputTypeForInput } from './types/index.js';

/**
 * Get the exported values for an input based on its type
 * @param {Object} input - Input object from InputLibrary
 * @returns {Array} Array of exported value definitions with metadata
 */
export function getInputExportedValues(input) {
	const inputType = getInputTypeForInput(input);
	return inputType.getExportedValues(input);
}
