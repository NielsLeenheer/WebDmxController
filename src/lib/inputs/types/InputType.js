/**
 * Base Input Type
 *
 * Defines the interface for input type definitions.
 * Subclasses define specific input behaviors and exported values.
 */
export class InputType {
	constructor(id, name) {
		this.id = id;
		this.name = name;
	}

	/**
	 * Get the exported values for this input type
	 * @param {Object} input - Input object from InputLibrary
	 * @returns {Array} Array of exported value definitions
	 */
	getExportedValues(input) {
		return [];
	}

	/**
	 * Check if this input type supports button-like behavior (triggers on press)
	 * @returns {boolean}
	 */
	isButton() {
		return false;
	}

	/**
	 * Check if this input type supports continuous values
	 * @returns {boolean}
	 */
	hasValues() {
		return false;
	}
}
