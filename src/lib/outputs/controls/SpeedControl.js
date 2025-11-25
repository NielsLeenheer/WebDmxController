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
			type: 'range',
			cssProperty: '--speed',
			min: 0,
			max: 255,
			unit: '',
			dmxMin: 0,
			dmxMax: 255,
			description: 'Speed (0-255)'
		};
	}
}
