import { SliderControlType } from './types/SliderControlType.js';

/**
 * Output Control
 * Controls output level (smoke, haze, fog, etc.)
 */
export class OutputControl extends SliderControlType {
	constructor() {
		super('output', 'Output');
	}

	/**
	 * Get gradient for output slider
	 * @returns {string} CSS gradient string
	 */
	getGradient() {
		return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(200,200,200) 100%)';
	}

	/**
	 * Get color for output control thumb
	 * @param {number} value - Output value (0-255)
	 * @returns {string} CSS color string
	 */
	getColor(value) {
		const intensity = Math.round((value ?? 0) * 0.784); // ~200/255
		return `rgb(${intensity}, ${intensity}, ${intensity})`;
	}
}
