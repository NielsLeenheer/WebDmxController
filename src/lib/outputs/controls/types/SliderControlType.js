import { ControlType } from './ControlType.js';

/**
 * Slider Control Type (1 channel: single value 0-255)
 *
 * Value metadata is defined inline based on the control name.
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
	 * Metadata is defined inline based on common control names.
	 *
	 * @param {string} controlName - Name of the control instance
	 * @param {string|null} channel - Not used for single-channel controls
	 * @returns {Object} Value metadata including cssProperty, min, max, unit
	 */
	getValueMetadata(controlName, channel = null) {
		const nameLower = controlName.toLowerCase();

		// Dimmer/Intensity: 0-1 (opacity-like)
		if (nameLower === 'dimmer' || nameLower === 'intensity') {
			return {
				cssProperty: '--intensity',
				min: 0,
				max: 1,
				unit: '',
				dmxMin: 0,
				dmxMax: 255,
				description: 'Intensity/Dimmer (0 to 1)'
			};
		}

		// Percentage-based controls (0% to 100%)
		if (nameLower === 'white') {
			return {
				cssProperty: '--white',
				min: 0,
				max: 100,
				unit: '%',
				dmxMin: 0,
				dmxMax: 255,
				description: 'White intensity (0% to 100%)'
			};
		}
		if (nameLower === 'amber') {
			return {
				cssProperty: '--amber',
				min: 0,
				max: 100,
				unit: '%',
				dmxMin: 0,
				dmxMax: 255,
				description: 'Amber intensity (0% to 100%)'
			};
		}
		if (nameLower === 'flame') {
			return {
				cssProperty: '--flame',
				min: 0,
				max: 100,
				unit: '%',
				dmxMin: 0,
				dmxMax: 255,
				description: 'Flame intensity (0% to 100%)'
			};
		}
		if (nameLower === 'smoke') {
			return {
				cssProperty: '--smoke',
				min: 0,
				max: 100,
				unit: '%',
				dmxMin: 0,
				dmxMax: 255,
				description: 'Smoke output (0% to 100%)'
			};
		}

		// Raw DMX value controls (0-255)
		if (nameLower === 'strobe') {
			return {
				cssProperty: '--strobe',
				min: 0,
				max: 255,
				unit: '',
				dmxMin: 0,
				dmxMax: 255,
				description: 'Strobe speed (0-255)'
			};
		}
		if (nameLower === 'speed') {
			return {
				cssProperty: '--speed',
				min: 0,
				max: 255,
				unit: '',
				dmxMin: 0,
				dmxMax: 255,
				description: 'Speed (0-255)'
			};
		}

		// Generic slider - derive CSS property from control name, use percentage
		return {
			cssProperty: `--${nameLower.replace(/\s+/g, '-')}`,
			min: 0,
			max: 100,
			unit: '%',
			dmxMin: 0,
			dmxMax: 255,
			description: `${controlName} (0% to 100%)`
		};
	}
}
