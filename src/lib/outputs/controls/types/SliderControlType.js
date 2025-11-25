import { ControlType } from './ControlType.js';
import { CONTROL_VALUE_TYPES } from '../valueTypes.js';

/**
 * Slider Control Type (1 channel: single value 0-255)
 */
export class SliderControlType extends ControlType {
	constructor(id, name = 'Slider') {
		super(id, name, 'slider', 0);
	}

	getChannelCount() {
		return 1;
	}

	// Input: plain number
	// Output: plain array [value]
	valueToDMX(value) {
		return [value ?? 0];
	}

	// Input: plain array [value, ...]
	// Output: plain number
	dmxToValue(dmxValues) {
		return dmxValues[0] ?? 0;
	}

	/**
	 * Get gradient for slider background
	 * @returns {string} CSS gradient string
	 */
	getGradient() {
		return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(128,128,128) 100%)';
	}

	/**
	 * Get color for slider thumb
	 * @param {number} value - Control value (0-255)
	 * @returns {string} CSS color string
	 */
	getColor(value) {
		const intensity = Math.round((value ?? 0) * 0.5);
		return `rgb(${intensity}, ${intensity}, ${intensity})`;
	}

	/**
	 * Get value metadata for this slider control
	 * @param {string} controlName - Name of the control instance
	 * @param {string|null} channel - Not used for single-channel controls
	 * @returns {Object} Value metadata
	 */
	getValueMetadata(controlName, channel = null) {
		const nameLower = controlName.toLowerCase();

		if (nameLower === 'dimmer' || nameLower === 'intensity') {
			return { ...CONTROL_VALUE_TYPES.intensity };
		}
		if (nameLower === 'white') {
			return { ...CONTROL_VALUE_TYPES.white };
		}
		if (nameLower === 'amber') {
			return { ...CONTROL_VALUE_TYPES.amber };
		}
		if (nameLower === 'flame') {
			return { ...CONTROL_VALUE_TYPES.flame };
		}
		if (nameLower === 'smoke') {
			return { ...CONTROL_VALUE_TYPES.smoke };
		}
		if (nameLower === 'strobe') {
			return { ...CONTROL_VALUE_TYPES.strobe };
		}
		if (nameLower === 'speed') {
			return { ...CONTROL_VALUE_TYPES.speed };
		}

		// Generic slider - derive CSS property from control name
		return {
			...CONTROL_VALUE_TYPES.percentageSlider,
			cssProperty: `--${nameLower.replace(/\s+/g, '-')}`
		};
	}
}
