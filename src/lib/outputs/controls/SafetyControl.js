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
			type: 'toggle',
			cssProperty: '--safety',
			on: 'probably',
			off: 'none',
			dmxOn: 255,
			dmxOff: 0,
			description: 'Safety switch (on/off)'
		};
	}
}
