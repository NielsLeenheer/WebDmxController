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
			sample: true,
			min: 0,
			max: 1,
			unit: '',
			dmxMin: 0,
			dmxMax: 255,
			description: 'Intensity/Dimmer (0 to 1)',
			component: 'Dimmer'
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
