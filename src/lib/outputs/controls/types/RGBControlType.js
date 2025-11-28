import { ControlType } from './ControlType.js';

/**
 * RGB Control Type (3 channels: red, green, blue)
 *
 * Each Control subclass must implement getValueMetadata() and getSamplingConfig()
 */
export class RGBControlType extends ControlType {
	constructor({ id, name }) {
		super({
			id,
			name,
			type: 'rgb',
			defaultValue: { red: 0, green: 0, blue: 0 }
		});
	}

	getChannelCount() {
		return 3;
	}

	// Input: plain object { red, green, blue }
	// Output: plain array [red, green, blue]
	valueToDMX(value) {
		return [
			value?.red ?? 0,
			value?.green ?? 0,
			value?.blue ?? 0
		];
	}

	// Input: plain array [red, green, blue, ...]
	// Output: plain object { red, green, blue }
	dmxToValue(dmxValues) {
		return {
			red: dmxValues[0] ?? 0,
			green: dmxValues[1] ?? 0,
			blue: dmxValues[2] ?? 0
		};
	}
}
