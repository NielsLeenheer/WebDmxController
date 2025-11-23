import { SliderControlType } from './types/SliderControlType.js';

/**
 * Dimmer Control
 * Controls overall brightness/intensity
 */
export class DimmerControl extends SliderControlType {
	constructor() {
		super('dimmer', 'Dimmer');
	}

	getGradient() {
		return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(255,255,255) 100%)';
	}

	getColor(value) {
		return `rgb(${value}, ${value}, ${value})`;
	}
}
