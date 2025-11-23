import { RGBControlType } from './types/RGBControlType.js';

/**
 * Color Control (RGB)
 * Single RGB control for color mixing
 */
export class ColorControl extends RGBControlType {
	constructor() {
		super('rgb', 'Color');
	}

	/**
	 * Get gradient for RGB or a specific component
	 * @param {string} [component] - Optional: 'Red', 'Green', or 'Blue' for component gradient
	 * @returns {string} CSS gradient string
	 */
	getGradient(component) {
		switch (component) {
			case 'Red':
				return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(255,0,0) 100%)';
			case 'Green':
				return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(0,255,0) 100%)';
			case 'Blue':
				return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(0,0,255) 100%)';
			default:
				return super.getGradient();
		}
	}

	/**
	 * Get color for RGB or a specific component
	 * @param {number} value - Component value (0-255)
	 * @param {string} [component] - Optional: 'Red', 'Green', or 'Blue' for component color
	 * @returns {string} CSS color string
	 */
	getColor(value, component) {
		switch (component) {
			case 'Red':
				return `rgb(${value}, 0, 0)`;
			case 'Green':
				return `rgb(0, ${value}, 0)`;
			case 'Blue':
				return `rgb(0, 0, ${value})`;
			default:
				return super.getColor(value);
		}
	}
}
