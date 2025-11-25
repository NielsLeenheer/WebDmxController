import { SliderControlType } from './types/SliderControlType.js';

/**
 * White Control
 * Controls white LED channel (for RGBW fixtures)
 */
export class WhiteControl extends SliderControlType {
	constructor() {
		super('white', 'White');
	}

	getGradient() {
		return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(255,255,255) 100%)';
	}

	getColor(value) {
		return `rgb(${value}, ${value}, ${value})`;
	}
}
