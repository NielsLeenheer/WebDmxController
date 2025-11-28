import { SliderControlType } from './types/SliderControlType.js';

/**
 * Flame Control
 * Controls flame height for flame machines
 */
export class FlameControl extends SliderControlType {
	constructor() {
		super({
			id: 'flame',
			name: 'Flame',
		});
	}

	getGradient() {
		return 'linear-gradient(to right, rgb(0,0,0) 0%, #ff5722 50%, #ff9800 75%, #ffc107 100%)';
	}

	getColor(value) {
		// Interpolate through flame gradient: black -> #ff5722 -> #ff9800 -> #ffc107
		if (value <= 127) {
			// 0-127: black (0,0,0) to red-orange (255,87,34)
			const t = value / 127;
			return `rgb(${Math.round(255 * t)}, ${Math.round(87 * t)}, ${Math.round(34 * t)})`;
		} else if (value <= 191) {
			// 128-191: red-orange (255,87,34) to orange (255,152,0)
			const t = (value - 127) / 64;
			return `rgb(255, ${Math.round(87 + (152 - 87) * t)}, ${Math.round(34 - 34 * t)})`;
		} else {
			// 192-255: orange (255,152,0) to yellow-orange (255,193,7)
			const t = (value - 191) / 64;
			return `rgb(255, ${Math.round(152 + (193 - 152) * t)}, ${Math.round(7 * t)})`;
		}
	}

	getValueMetadata() {
		return {
			values: [{
				id: 'flame',
				label: 'Flame',
				type: 'range',
				cssProperty: '--flame',
				sample: true,
				min: 0,
				max: 100,
				unit: '%',
				dmxMin: 0,
				dmxMax: 255,
				description: 'Flame intensity (0% to 100%)'
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
