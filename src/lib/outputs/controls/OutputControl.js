import { SliderControlType } from './types/SliderControlType.js';

/**
 * Smoke Control
 * Controls smoke/haze/fog output level
 */
export class SmokeControl extends SliderControlType {
	constructor() {
		super('smoke', 'Smoke');
	}

	/**
	 * Get gradient for smoke slider
	 * @returns {string} CSS gradient string
	 */
	getGradient() {
		return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(200,200,200) 100%)';
	}

	/**
	 * Get color for smoke control thumb
	 * @param {number} value - Smoke value (0-255)
	 * @returns {string} CSS color string
	 */
	getColor(value) {
		const intensity = Math.round((value ?? 0) * 0.784); // ~200/255
		return `rgb(${intensity}, ${intensity}, ${intensity})`;
	}

	getValueMetadata() {
		return {
			type: 'range',
			cssProperty: '--smoke',
			sample: true,
			min: 0,
			max: 100,
			unit: '%',
			dmxMin: 0,
			dmxMax: 255,
			description: 'Smoke output (0% to 100%)',
			component: 'Smoke'
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
