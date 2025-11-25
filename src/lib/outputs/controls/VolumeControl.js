import { SliderControlType } from './types/SliderControlType.js';

/**
 * Volume Control
 * Controls audio volume or sound level
 */
export class VolumeControl extends SliderControlType {
	constructor() {
		super('volume', 'Volume');
	}

	getGradient() {
		return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(200,200,200) 100%)';
	}

	getColor(value) {
		const intensity = Math.round(value * 0.784);
		return `rgb(${intensity}, ${intensity}, ${intensity})`;
	}
}
