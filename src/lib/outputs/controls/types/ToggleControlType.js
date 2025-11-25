import { ControlType } from './ControlType.js';
import { CONTROL_VALUE_TYPES } from '../valueTypes.js';

/**
 * Toggle Control Type (1 channel: on/off values)
 * Used for binary switches like Safety controls
 *
 * Differs from SliderControl in that it has discrete on/off values
 * rather than a continuous range.
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
	 * Get value metadata for this toggle control
	 * @param {string} controlName - Name of the control instance
	 * @param {string|null} channel - Not used for single-channel controls
	 * @returns {Object} Value metadata
	 */
	getValueMetadata(controlName, channel = null) {
		const nameLower = controlName.toLowerCase();

		if (nameLower === 'safety') {
			return { ...CONTROL_VALUE_TYPES.safety };
		}

		// Generic toggle - derive CSS property from control name
		return {
			cssProperty: `--${nameLower.replace(/\s+/g, '-')}`,
			min: 0,
			max: 255,
			unit: '',
			dmxMin: this.offValue,
			dmxMax: this.onValue,
			isToggle: true,
			description: `${controlName} (on/off)`
		};
	}
}
