import { SliderControlType } from './types/SliderControlType.js';

/**
 * Prism Control
 * Single channel: 0-99 off, 100-127 prism on (18-facet), 128-255 rotating prism.
 */
export class PrismControl extends SliderControlType {
	constructor() {
		super({
			id: 'prism',
			name: 'Prism',
		});
	}

	getGradient() {
		// 0-99 off (dark), 100-127 on (neutral), 128-255 rotation (cyan to magenta).
		return 'linear-gradient(to right, rgb(30,30,30) 0%, rgb(30,30,30) 38.8%, rgb(180,180,220) 39.2%, rgb(180,180,220) 49.8%, rgb(80,200,220) 50.2%, rgb(220,80,200) 100%)';
	}

	getColor(value) {
		if (value <= 99) return 'rgb(40, 40, 40)';
		if (value <= 127) return 'rgb(180, 180, 220)';
		const t = (value - 128) / 127;
		const r = Math.round(80 + (220 - 80) * t);
		const g = Math.round(200 + (80 - 200) * t);
		const b = Math.round(220 + (200 - 220) * t);
		return `rgb(${r}, ${g}, ${b})`;
	}

	getValueMetadata() {
		return {
			values: [{
				id: 'prism',
				label: 'Prism',
				type: 'range',
				cssProperty: '--prism',
				sample: true,
				min: 0,
				max: 255,
				unit: '',
				dmxMin: 0,
				dmxMax: 255,
				description: 'Prism (off / on / rotating)'
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
