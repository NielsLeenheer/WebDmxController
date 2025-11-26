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
			sample: true,
			on: 'probably',
			off: 'none',
			dmxOn: 255,
			dmxOff: 0,
			description: 'Safety switch (on/off)',
			component: 'Safety'
		};
	}

	getSamplingConfig() {
		const meta = this.getValueMetadata();
		return {
			cssProperty: meta.cssProperty,
			parse: (cssValue) => {
				const value = cssValue.trim().toLowerCase();
				const isOn = value === String(meta.on).toLowerCase() ||
					value === String(meta.dmxOn);
				return { [meta.component]: isOn ? meta.dmxOn : meta.dmxOff };
			}
		};
	}
}
