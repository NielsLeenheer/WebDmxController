import { ControlType } from './ControlType.js';

/**
 * RGBA Control Type (4 channels: red, green, blue, amber/white)
 */
export class RGBAControl extends ControlType {
	constructor() {
		super('rgba', 'RGBA', 'rgba', { r: 0, g: 0, b: 0, a: 0 });
	}

	getChannelCount() {
		return 4;
	}

	// Input: plain object { r, g, b, a }
	// Output: plain array [r, g, b, a]
	valueToDMX(value) {
		return [
			value?.r ?? 0,
			value?.g ?? 0,
			value?.b ?? 0,
			value?.a ?? 0
		];
	}

	// Input: plain array [r, g, b, a, ...]
	// Output: plain object { r, g, b, a }
	dmxToValue(dmxValues) {
		return {
			r: dmxValues[0] ?? 0,
			g: dmxValues[1] ?? 0,
			b: dmxValues[2] ?? 0,
			a: dmxValues[3] ?? 0
		};
	}
}
