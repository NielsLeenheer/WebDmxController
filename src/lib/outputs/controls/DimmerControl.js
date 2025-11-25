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
		return 'linear-gradient(to right, rgb(255,255,255) 0%, rgb(0,0,0) 100%)';
	}

	getColor(value) {
		const inverted = 255 - value;
		return `rgb(${inverted}, ${inverted}, ${inverted})`;
	}

	getValueMetadata() {
		return {
			type: 'range',
			cssProperty: '--intensity',
			min: 0,
			max: 1,
			unit: '',
			dmxMin: 0,
			dmxMax: 255,
			description: 'Intensity/Dimmer (0 to 1)'
		};
	}
}
