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

	getValueMetadata() {
		return {
			type: 'range',
			cssProperty: '--amber',
			sample: true,
			min: 0,
			max: 100,
			unit: '%',
			dmxMin: 0,
			dmxMax: 255,
			description: 'Amber intensity (0% to 100%)',
			component: 'Amber'
		};
	}
}
