import { SliderControlType } from './types/SliderControlType.js';

/**
 * Fan Control
 * Controls fan speed for flame/fog machines
 */
export class FanControl extends SliderControlType {
	constructor() {
		super('fan', 'Fan');
	}

	getValueMetadata() {
		return {
			type: 'range',
			cssProperty: '--fan',
			sample: true,
			min: 0,
			max: 100,
			unit: '%',
			dmxMin: 0,
			dmxMax: 255,
			description: 'Fan speed (0% to 100%)',
			component: 'Fan'
		};
	}
}
