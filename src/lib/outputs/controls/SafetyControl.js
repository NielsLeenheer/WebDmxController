import { ToggleControlType } from './types/ToggleControlType.js';

/**
 * Safety Control
 * Binary safety switch for flame machines
 */
export class SafetyControl extends ToggleControlType {
	constructor() {
		super('safety', 'Safety', 0, 255);
	}

	getValueMetadata() {
		return {
			cssProperty: '--safety',
			min: 0,
			max: 255,
			unit: '',
			dmxMin: 0,
			dmxMax: 255,
			isToggle: true,
			description: 'Safety switch (on/off)'
		};
	}
}
