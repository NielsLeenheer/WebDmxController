import { ControlType } from './ControlType.js';

/**
 * Toggle Control Type (1 channel: on/off values)
 * Used for binary switches like Safety controls
 *
 * Differs from SliderControl in that it has discrete on/off values
 * rather than a continuous range.
 *
 * Subclasses should override getValueMetadata() with control-specific metadata.
 */
export class ToggleControlType extends ControlType {
	constructor(id, name = 'Toggle', offValue = 0, onValue = 255) {
		super(id, name, 'toggle', offValue);
		this.offValue = offValue;
		this.onValue = onValue;
	}

	getChannelCount() {
		return 1;
	}

	// Input: plain number (offValue or onValue)
	// Output: plain array [value]
	valueToDMX(value) {
		return [value ?? this.offValue];
	}

	// Input: plain array [value, ...]
	// Output: plain number
	dmxToValue(dmxValues) {
		return dmxValues[0] ?? this.offValue;
	}

	/**
	 * Get default value (off state)
	 */
	getDefaultValue() {
		return this.offValue;
	}

	/**
	 * Get value metadata for this toggle control.
	 * Subclasses should override this with control-specific metadata.
	 * This provides a generic fallback based on the control id/name.
	 *
	 * @param {string|null} channel - Not used for single-channel controls
	 * @returns {Object} Value metadata
	 */
	getValueMetadata(channel = null) {
		// Generic toggle - derive CSS property from control id
		return {
			type: 'toggle',
			cssProperty: `--${this.id.replace(/\s+/g, '-')}`,
			on: this.onValue,
			off: this.offValue,
			dmxOn: this.onValue,
			dmxOff: this.offValue,
			description: `${this.name} (on/off)`
		};
	}
}
