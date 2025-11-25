import { ControlType } from './ControlType.js';

/**
 * RGB Control Type (3 channels: red, green, blue)
 */
export class RGBControlType extends ControlType {
	constructor(id = 'rgb', name = 'RGB') {
		super(id, name, 'rgb', { r: 0, g: 0, b: 0 });
	}

	getChannelCount() {
		return 3;
	}

	// Input: plain object { r, g, b }
	// Output: plain array [r, g, b]
	valueToDMX(value) {
		return [
			value?.r ?? 0,
			value?.g ?? 0,
			value?.b ?? 0
		];
	}

	// Input: plain array [r, g, b, ...]
	// Output: plain object { r, g, b }
	dmxToValue(dmxValues) {
		return {
			r: dmxValues[0] ?? 0,
			g: dmxValues[1] ?? 0,
			b: dmxValues[2] ?? 0
		};
	}
}
