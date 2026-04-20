import { ToggleControlType } from './types/ToggleControlType.js';

/**
 * Heating Control
 * Single channel: 0-99 off, 100-255 on. ~4min preheat after switching on.
 */
export class HeatingControl extends ToggleControlType {
	constructor() {
		super({
			id: 'heating',
			name: 'Heating',
			offValue: 50,
			onValue: 200,
		});
	}

	getValueMetadata() {
		return {
			values: [{
				id: 'heating',
				label: 'Heating',
				type: 'toggle',
				cssProperty: '--heating',
				sample: true,
				on: 'on',
				off: 'off',
				dmxOn: 200,
				dmxOff: 50,
				description: 'Heating element (on/off)'
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
