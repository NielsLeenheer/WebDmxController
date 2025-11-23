import { SliderControlType } from './types/SliderControlType.js';

/**
 * Fan Control
 * Controls fan speed for flame/fog machines
 */
export class FanControl extends SliderControlType {
	constructor() {
		super('fan', 'Fan');
	}
}
