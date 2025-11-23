import { SliderControlType } from './types/SliderControlType.js';

/**
 * Amber Control
 * Controls amber LED channel (for RGBA fixtures)
 */
export class AmberControl extends SliderControlType {
	constructor() {
		super('amber', 'Amber');
	}

	getGradient() {
		return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(255,191,0) 100%)';
	}

	getColor(value) {
		return `rgb(${value}, ${Math.round(value * 0.749)}, 0)`;
	}
}
