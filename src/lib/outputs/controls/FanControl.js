import { SliderControlType } from './types/SliderControlType.js';

/**
 * Fan Control
 * Controls fan speed for flame/fog machines
 */
export class FanControl extends SliderControlType {
	constructor() {
		super({
			id: 'fan',
			name: 'Fan',
		});
	}

	getValueMetadata() {
		return {
			values: [{
				id: 'fan',
				label: 'Fan',
				type: 'range',
				cssProperty: '--fan',
				sample: true,
				min: 0,
				max: 100,
				unit: '%',
				dmxMin: 0,
				dmxMax: 255,
				description: 'Fan speed (0% to 100%)'
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
