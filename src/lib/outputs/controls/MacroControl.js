import { ToggleControlType } from './types/ToggleControlType.js';

/**
 * Macro ("Various Colors") Control
 * Single channel: 0-126 macro closed, 127-255 macro open.
 */
export class MacroControl extends ToggleControlType {
	constructor() {
		super({
			id: 'macro',
			name: 'Macro',
			offValue: 64,
			onValue: 191,
		});
	}

	getValueMetadata() {
		return {
			values: [{
				id: 'macro',
				label: 'Macro',
				type: 'toggle',
				cssProperty: '--macro',
				sample: true,
				on: 'open',
				off: 'closed',
				dmxOn: 191,
				dmxOff: 64,
				description: 'Colorful macro (open/closed)'
			}]
		};
	}

	getSamplingConfig() {
		const meta = this.getValueMetadata().values[0];
		return {
			cssProperty: meta.cssProperty,
			parse: (cssValue) => {
				const value = cssValue.trim().toLowerCase();
				const isOn = value === String(meta.on).toLowerCase() ||
					value === String(meta.dmxOn);
				return isOn ? meta.dmxOn : meta.dmxOff;
			}
		};
	}
}
