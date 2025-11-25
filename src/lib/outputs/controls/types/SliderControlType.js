import { ControlType } from './ControlType.js';

/**
 * Slider Control Type (1 channel: single value 0-255)
 *
 * Subclasses should override getValueMetadata() with control-specific metadata.
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
	 * Get value metadata for this slider control.
	 * Subclasses should override this with control-specific metadata.
	 * This provides a generic fallback based on the control id/name.
	 *
	 * @param {string|null} channel - Not used for single-channel controls
	 * @returns {Object} Value metadata including cssProperty, min, max, unit
	 */
	getValueMetadata(channel = null) {
		// Generic slider - derive CSS property from control id, use percentage
		return {
			type: 'range',
			cssProperty: `--${this.id.replace(/\s+/g, '-')}`,
			min: 0,
			max: 100,
			unit: '%',
			dmxMin: 0,
			dmxMax: 255,
			description: `${this.name} (0% to 100%)`
		};
	}
}
