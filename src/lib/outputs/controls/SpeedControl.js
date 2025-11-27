import { SliderControlType } from './types/SliderControlType.js';

/**
 * Speed Control
 * Controls animation or effect speed
 */
export class SpeedControl extends SliderControlType {
	constructor() {
		super('speed', 'Speed');
	}

	getValueMetadata() {
		return {
			values: [{
				id: 'speed',
				label: 'Speed',
				type: 'range',
				cssProperty: '--speed',
				sample: true,
				min: 0,
				max: 255,
				unit: '',
				dmxMin: 0,
				dmxMax: 255,
				description: 'Speed (0-255)'
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
