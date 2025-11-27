import { ControlType } from './ControlType.js';

/**
 * XY Pad Control Type (2 channels: pan, tilt)
 * Used for Pan/Tilt on 8-bit devices
 *
 * Each Control subclass must implement getValueMetadata() and getSamplingConfig()
 */
export class XYPadControlType extends ControlType {
	constructor({ id, name }) {
		super({
			id,
			name,
			type: 'xypad',
			defaultValue: { pan: 128, tilt: 128 }
		});
	}

	getChannelCount() {
		return 2;
	}

	// Input: plain object { pan, tilt }
	// Output: plain array [pan, tilt]
	valueToDMX(value) {
		return [
			value?.pan ?? 128,
			value?.tilt ?? 128
		];
	}

	// Input: plain array [pan, tilt, ...]
	// Output: plain object { pan, tilt }
	dmxToValue(dmxValues) {
		return {
			pan: dmxValues[0] ?? 128,
			tilt: dmxValues[1] ?? 128
		};
	}
}
