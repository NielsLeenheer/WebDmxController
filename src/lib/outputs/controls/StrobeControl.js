import { SliderControlType } from './types/SliderControlType.js';

/**
 * Strobe Control
 * Controls strobe/flash effect speed
 */
export class StrobeControl extends SliderControlType {
	constructor() {
		super('strobe', 'Strobe');
	}

	/**
	 * Get gradient for strobe slider
	 * Alternating black and gray blocks that get progressively thinner
	 * @returns {string} CSS gradient string
	 */
	getGradient() {
		// Create many alternating black/gray blocks with decreasing width
		const stops = [];
		
		// Define block sizes that progressively get smaller
		const rawSizes = [7, 7, 6, 6, 5, 5, 4, 4, 3.5, 3.5, 3, 3, 2.5, 2.5, 2, 2, 1.75, 1.75, 1.5, 1.5, 1.25, 1.25, 1, 1, 0.9, 0.9, 0.8, 0.8, 0.7, 0.7, 0.6, 0.6, 0.5, 0.5];
		
		// Calculate total and normalize to 100%
		const total = rawSizes.reduce((sum, size) => sum + size, 0);
		const blockSizes = rawSizes.map(size => (size / total) * 100);
		
		let position = 0;
		
		for (let i = 0; i < blockSizes.length; i++) {
			const size = blockSizes[i];
			const color = i % 2 === 0 ? '#000' : 'rgb(128, 128, 128)';
			
			stops.push(`${color} ${position.toFixed(2)}%`);
			position += size;
			stops.push(`${color} ${position.toFixed(2)}%`);
		}
		
		return `linear-gradient(to right, ${stops.join(', ')})`;
	}

	/**
	 * Get color for strobe control thumb
	 * @param {number} value - Strobe value (0-255)
	 * @returns {string} CSS color string
	 */
	getColor(value) {
		// Always black for strobe
		return '#000';
	}

	getValueMetadata() {
		return {
			type: 'range',
			cssProperty: '--strobe',
			sample: true,
			min: 0,
			max: 255,
			unit: '',
			dmxMin: 0,
			dmxMax: 255,
			description: 'Strobe speed (0-255)',
			component: 'Strobe'
		};
	}
}
