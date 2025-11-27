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

	getValueMetadata() {
		return {
			values: [{
				id: 'volume',
				label: 'Volume',
				type: 'range',
				cssProperty: '--volume',
				sample: true,
				min: 0,
				max: 100,
				unit: '%',
				dmxMin: 0,
				dmxMax: 255,
				description: 'Volume level (0% to 100%)'
			}]
		};
	}

	getSamplingConfig() {
		const meta = this.getValueMetadata().values[0];
		return {
			cssProperty: meta.cssProperty,
			parse: (cssValue) => {
				const match = cssValue.match(/(-?\d+(?:\.\d+)?)/);
				const value = match ? parseFloat(match[1]) : 0;
				const normalized = (value - meta.min) / (meta.max - meta.min);
				const dmxValue = Math.round(normalized * (meta.dmxMax - meta.dmxMin) + meta.dmxMin);
				return { [meta.id]: Math.max(meta.dmxMin, Math.min(meta.dmxMax, dmxValue)) };
			}
		};
	}
}
