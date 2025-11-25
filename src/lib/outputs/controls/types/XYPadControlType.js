import { ControlType } from './ControlType.js';

/**
 * XY Pad Control Type (2 channels: x, y)
 * Used for Pan/Tilt on 8-bit devices
 */
export class XYPadControlType extends ControlType {
	constructor(id, name = 'Pan/Tilt') {
		super(id, name, 'xypad', { x: 128, y: 128 });
	}

	getChannelCount() {
		return 2;
	}

	// Input: plain object { x, y }
	// Output: plain array [x, y]
	valueToDMX(value) {
		return [
			value?.x ?? 128,
			value?.y ?? 128
		];
	}

	// Input: plain array [x, y, ...]
	// Output: plain object { x, y }
	dmxToValue(dmxValues) {
		return {
			x: dmxValues[0] ?? 128,
			y: dmxValues[1] ?? 128
		};
	}
}
