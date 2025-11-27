/**
 * Base Control Type Class
 *
 * All control types extend this base class which provides:
 * - Conversion between control values and DMX arrays
 * - Default values for each control type
 * - Channel count information
 *
 * Key Architecture Points:
 * - Control types are CLASSES (definitions, not data)
 * - They work with PLAIN OBJECTS and ARRAYS (not class instances)
 * - These are singletons - created once, shared across the app
 * - They provide methods for conversion, validation, defaults
 * - They are NOT stored in $state or localStorage
 */
export class ControlType {
	constructor(id, name, type, defaultValue) {
		this.id = id;          // Unique identifier string
		this.name = name;      // Display name
		this.type = type;      // UI type: 'rgb', 'slider', 'xypad', etc.
		this.defaultValue = defaultValue;  // Default control value
	}

	/**
	 * Get channel count for this control
	 * @returns {number} Number of DMX channels this control uses
	 */
	getChannelCount() {
		throw new Error('Must implement getChannelCount()');
	}

	/**
	 * Convert control value (plain object/number) to DMX array
	 * @param {*} value - Control value (plain object, number, etc.)
	 * @returns {Array<number>} DMX values for this control's channels (0-255)
	 */
	valueToDMX(value) {
		throw new Error('Must implement valueToDMX()');
	}

	/**
	 * Convert DMX array to control value (plain object/number)
	 * @param {Array<number>} dmxValues - DMX values starting at this control
	 * @returns {*} Control value (plain object/number)
	 */
	dmxToValue(dmxValues) {
		throw new Error('Must implement dmxToValue()');
	}

	/**
	 * Get default value as plain object/number
	 * Returns a copy to avoid shared references
	 * @returns {*} Default value (plain object/number, safe for $state)
	 */
	getDefaultValue() {
		// Return a copy to avoid shared references
		if (typeof this.defaultValue === 'object' && this.defaultValue !== null) {
			return { ...this.defaultValue };
		}
		return this.defaultValue;
	}

	/**
	 * Get slider gradient for UI display
	 * @returns {string} CSS gradient string
	 */
	getGradient() {
		// Fallback: solid gray
		return 'rgb(128, 128, 128)';
	}

	/**
	 * Get color for UI display based on current value
	 * @param {*} value - Current control value
	 * @returns {string} CSS color string
	 */
	getColor(value) {
		// Fallback: solid gray
		return 'rgb(128, 128, 128)';
	}

	/**
	 * Get value metadata for this control type
	 * Used by value-based triggers for type conversion
	 * @returns {Object} Value metadata with values array containing id, label, CSS property, range, unit
	 */
	getValueMetadata() {
		// Override in subclasses
		return { values: [] };
	}

	/**
	 * Get sampling configuration for this control
	 * Defines how to sample CSS values and convert to DMX
	 * @returns {Object|null} Sampling config with cssProperty and parse function
	 */
	getSamplingConfig() {
		// Override in subclasses
		return null;
	}
}
