import { ControlType } from './ControlType.js';

/**
 * 16-bit XY Pad Control Type (4 channels: pan, 0, tilt, 0)
 * Used for Pan/Tilt on devices that expect 16-bit channel layout
 *
 * Uses 8-bit values internally (0-255) for consistency with XYPadControlType.
 * The fine channels are left at 0 since CSS-based control provides sufficient precision.
 *
 * Each Control subclass must implement getValueMetadata() and getSamplingConfig()
 */
export class XYPad16ControlType extends ControlType {
	constructor({ id, name }) {
		super({
			id,
			name,
			type: 'xypad16',
			defaultValue: { pan: 128, tilt: 128 }
		});
	}

	getChannelCount() {
		return 4;  // Pan, Pan Fine (0), Tilt, Tilt Fine (0)
	}

	// Input: plain object { pan, tilt } (8-bit values 0-255)
	// Output: plain array [pan, 0, tilt, 0]
	valueToDMX(value) {
		return [
			value?.pan ?? 128,
			0,  // Pan fine (unused)
			value?.tilt ?? 128,
			0   // Tilt fine (unused)
		];
	}

	// Input: plain array [pan, panFine, tilt, tiltFine, ...]
	// Output: plain object { pan, tilt } (8-bit values 0-255)
	dmxToValue(dmxValues) {
		return {
			pan: dmxValues[0] ?? 128,
			tilt: dmxValues[2] ?? 128
		};
	}
}
