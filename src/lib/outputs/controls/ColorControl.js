import { RGBControlType } from './types/RGBControlType.js';

/**
 * Color Control (RGB)
 * Single RGB control for color mixing
 */
export class ColorControl extends RGBControlType {
	constructor() {
		super({
			id: 'color',
			name: 'Color',
		});
	}

	/**
	 * Get gradient for RGB or a specific component
	 * @param {string} [id] - Optional: 'red', 'green', or 'blue' for component gradient
	 * @returns {string} CSS gradient string
	 */
	getGradient(id) {
		switch (id) {
			case 'red':
				return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(255,0,0) 100%)';
			case 'green':
				return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(0,255,0) 100%)';
			case 'blue':
				return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(0,0,255) 100%)';
			default:
				return super.getGradient();
		}
	}

	/**
	 * Get color for RGB or a specific component
	 * @param {number|Object} value - Component value (0-255) or RGB object {red, green, blue}
	 * @param {string} [id] - Optional: 'red', 'green', or 'blue' for component color
	 * @returns {string} CSS color string
	 */
	getColor(value, id) {
		// Handle component-specific colors
		if (id) {
			switch (id) {
				case 'red':
					return `rgb(${value}, 0, 0)`;
				case 'green':
					return `rgb(0, ${value}, 0)`;
				case 'blue':
					return `rgb(0, 0, ${value})`;
			}
		}
		
		// Handle RGB object (full color)
		if (typeof value === 'object' && value !== null) {
			const r = value.red ?? 0;
			const g = value.green ?? 0;
			const b = value.blue ?? 0;
			return `rgb(${r}, ${g}, ${b})`;
		}
		
		// Fallback to parent (gray)
		return super.getColor(value);
	}

	getValueMetadata() {
		const redMeta = {
			id: 'red',
			label: 'Red',
			type: 'range',
			cssProperty: '--red',
			sample: false, // Sampled from combined 'color' property
			min: 0,
			max: 255,
			unit: '',
			dmxMin: 0,
			dmxMax: 255,
			description: 'Red channel (0-255)'
		};

		const greenMeta = {
			id: 'green',
			label: 'Green',
			type: 'range',
			cssProperty: '--green',
			sample: false, // Sampled from combined 'color' property
			min: 0,
			max: 255,
			unit: '',
			dmxMin: 0,
			dmxMax: 255,
			description: 'Green channel (0-255)'
		};

		const blueMeta = {
			id: 'blue',
			label: 'Blue',
			type: 'range',
			cssProperty: '--blue',
			sample: false, // Sampled from combined 'color' property
			min: 0,
			max: 255,
			unit: '',
			dmxMin: 0,
			dmxMax: 255,
			description: 'Blue channel (0-255)'
		};

		const colorMeta = {
			id: 'color',
			label: 'Color',
			type: 'composite',
			cssProperty: 'color',
			value: 'rgb(var(--red), var(--green), var(--blue))',
			sample: true, // This is the property we sample from
			description: 'Combined RGB color'
		};

		return {
			values: [redMeta, greenMeta, blueMeta, colorMeta]
		};
	}

	/**
	 * Get sampling configuration for this control
	 * RGB samples from the combined 'color' property
	 */
	getSamplingConfig() {
		return {
			cssProperty: 'color',
			parse: (cssValue) => {
				const match = cssValue.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
				if (!match) return null;
				return {
					red: parseInt(match[1]),
					green: parseInt(match[2]),
					blue: parseInt(match[3])
				};
			}
		};
	}
}
