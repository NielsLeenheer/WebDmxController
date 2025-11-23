import { SliderControlType } from './types/SliderControlType.js';

/**
 * Strobe Control
 * Controls strobe/flash effect speed
 */
export class StrobeControl extends SliderControlType {
	constructor() {
		super('strobe', 'Strobe');
	}
}
