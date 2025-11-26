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

	getValueMetadata() {
		return {
			type: 'range',
			cssProperty: '--white',
			sample: true,
			min: 0,
			max: 100,
			unit: '%',
			dmxMin: 0,
			dmxMax: 255,
			description: 'White intensity (0% to 100%)',
			component: 'White'
		};
	}

	getSamplingConfig() {
		const meta = this.getValueMetadata();
		return {
			cssProperty: meta.cssProperty,
			parse: (cssValue) => {
				const match = cssValue.match(/(-?\d+(?:\.\d+)?)/);
				const value = match ? parseFloat(match[1]) : 0;
				const normalized = (value - meta.min) / (meta.max - meta.min);
				const dmxValue = Math.round(normalized * (meta.dmxMax - meta.dmxMin) + meta.dmxMin);
				return { [meta.component]: Math.max(meta.dmxMin, Math.min(meta.dmxMax, dmxValue)) };
			}
		};
	}
}
