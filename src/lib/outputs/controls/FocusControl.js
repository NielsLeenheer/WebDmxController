import { SliderControlType } from './types/SliderControlType.js';

export class FocusControl extends SliderControlType {
	constructor() {
		super({
			id: 'focus',
			name: 'Focus',
		});
	}

	getGradient() {
		return 'linear-gradient(to right, rgb(200,200,200) 0%, rgb(60,60,60) 100%)';
	}

	getColor(value) {
		const v = 200 - Math.round((value ?? 0) * (140 / 255));
		return `rgb(${v}, ${v}, ${v})`;
	}

	getValueMetadata() {
		return {
			values: [{
				id: 'focus',
				label: 'Focus',
				type: 'range',
				cssProperty: '--focus',
				sample: true,
				min: 0,
				max: 255,
				unit: '',
				dmxMin: 0,
				dmxMax: 255,
				description: 'Focus clarity (0-255)'
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
				return Math.max(meta.dmxMin, Math.min(meta.dmxMax, dmxValue));
			}
		};
	}
}
