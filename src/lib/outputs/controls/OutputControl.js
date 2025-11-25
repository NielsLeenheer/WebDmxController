import { SliderControlType } from './types/SliderControlType.js';

/**
 * Smoke Control
 * Controls smoke/haze/fog output level
 */
export class SmokeControl extends SliderControlType {
	constructor() {
		super('smoke', 'Smoke');
	}

	/**
	 * Get gradient for smoke slider
	 * @returns {string} CSS gradient string
	 */
	getGradient() {
		return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(200,200,200) 100%)';
	}

	/**
	 * Get color for smoke control thumb
	 * @param {number} value - Smoke value (0-255)
	 * @returns {string} CSS color string
	 */
	getColor(value) {
		const intensity = Math.round((value ?? 0) * 0.784); // ~200/255
		return `rgb(${intensity}, ${intensity}, ${intensity})`;
	}
}
