import { ControlType } from './ControlType.js';

/**
 * 16-bit XY Pad Control Type (4 channels: pan, pan fine, tilt, tilt fine)
 * Used for Pan/Tilt on 16-bit devices (moving heads with fine control)
 *
 * Note: The UI works with 8-bit values (0-255) for pan and tilt,
 * but this control expands them to 16-bit for fine control
 *
 * Each Control subclass must implement getValueMetadata() and getSamplingConfig()
 */
export class XYPad16ControlType extends ControlType {
	constructor({ id, name }) {
		super({
			id,
			name,
			type: 'xypad',
			defaultValue: { pan: 128, tilt: 128 }
		});
	}

	getChannelCount() {
		return 4;  // Pan, Pan Fine, Tilt, Tilt Fine
	}

	// Input: plain object { pan, tilt } (8-bit values 0-255)
	// Output: plain array [pan, panFine, tilt, tiltFine] (16-bit expanded)
	valueToDMX(value) {
		const pan = value?.pan ?? 128;
		const tilt = value?.tilt ?? 128;

		// Convert 8-bit to 16-bit: value * 257
		// This ensures 0 → 0, 255 → 65535
		const pan16 = Math.round(pan * 257);
		const tilt16 = Math.round(tilt * 257);

		return [
			pan16 >> 8,        // Pan coarse (high byte)
			pan16 & 0xFF,      // Pan fine (low byte)
			tilt16 >> 8,        // Tilt coarse (high byte)
			tilt16 & 0xFF       // Tilt fine (low byte)
		];
	}

	// Input: plain array [pan, panFine, tilt, tiltFine, ...]
	// Output: plain object { pan, tilt } (8-bit values 0-255)
	dmxToValue(dmxValues) {
		// Combine coarse and fine into 16-bit values
		const pan16 = ((dmxValues[0] ?? 0) << 8) | (dmxValues[1] ?? 0);
		const tilt16 = ((dmxValues[2] ?? 0) << 8) | (dmxValues[3] ?? 0);

		// Convert 16-bit back to 8-bit
		return {
			pan: Math.round(pan16 / 257),
			tilt: Math.round(tilt16 / 257)
		};
	}
}
