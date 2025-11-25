import { ControlType } from './ControlType.js';

/**
 * 16-bit XY Pad Control Type (4 channels: pan, pan fine, tilt, tilt fine)
 * Used for Pan/Tilt on 16-bit devices (moving heads with fine control)
 *
 * Note: The UI works with 8-bit values (0-255) for x and y,
 * but this control expands them to 16-bit for fine control
 */
export class XYPad16ControlType extends ControlType {
	constructor(id, name = 'Pan/Tilt') {
		super(id, name, 'xypad', { x: 128, y: 128 });
	}

	getChannelCount() {
		return 4;  // Pan, Pan Fine, Tilt, Tilt Fine
	}

	// Input: plain object { x, y } (8-bit values 0-255)
	// Output: plain array [pan, panFine, tilt, tiltFine] (16-bit expanded)
	valueToDMX(value) {
		const x = value?.x ?? 128;
		const y = value?.y ?? 128;

		// Convert 8-bit to 16-bit: value * 257
		// This ensures 0 → 0, 255 → 65535
		const x16 = Math.round(x * 257);
		const y16 = Math.round(y * 257);

		return [
			x16 >> 8,        // Pan coarse (high byte)
			x16 & 0xFF,      // Pan fine (low byte)
			y16 >> 8,        // Tilt coarse (high byte)
			y16 & 0xFF       // Tilt fine (low byte)
		];
	}

	// Input: plain array [pan, panFine, tilt, tiltFine, ...]
	// Output: plain object { x, y } (8-bit values 0-255)
	dmxToValue(dmxValues) {
		// Combine coarse and fine into 16-bit values
		const x16 = ((dmxValues[0] ?? 0) << 8) | (dmxValues[1] ?? 0);
		const y16 = ((dmxValues[2] ?? 0) << 8) | (dmxValues[3] ?? 0);

		// Convert 16-bit back to 8-bit
		return {
			x: Math.round(x16 / 257),
			y: Math.round(y16 / 257)
		};
	}

	/**
	 * Get value metadata for this 16-bit XY pad control
	 * Uses same metadata as 8-bit XY pad (UI works in 8-bit)
	 *
	 * @param {string} controlName - Name of the control instance
	 * @param {string|null} channel - 'pan'/'x' or 'tilt'/'y'
	 * @returns {Object} Value metadata
	 */
	getValueMetadata(controlName, channel = null) {
		// Pan: -50% to +50% centered at 0
		const panMeta = {
			cssProperty: '--pan',
			min: -50,
			max: 50,
			unit: '%',
			dmxMin: 0,
			dmxMax: 255,
			description: 'Pan position (-50% to +50%)',
			channel: 'x'
		};

		// Tilt: 0% to 100%
		const tiltMeta = {
			cssProperty: '--tilt',
			min: 0,
			max: 100,
			unit: '%',
			dmxMin: 0,
			dmxMax: 255,
			description: 'Tilt position (0% to 100%)',
			channel: 'y'
		};

		if (channel === 'pan' || channel === 'x') {
			return panMeta;
		}
		if (channel === 'tilt' || channel === 'y') {
			return tiltMeta;
		}

		// Return both channels if no specific channel requested
		return {
			channels: [
				{ ...panMeta, key: 'pan' },
				{ ...tiltMeta, key: 'tilt' }
			]
		};
	}

	/**
	 * Get available channels for this control type
	 * @returns {Array} Array of channel definitions
	 */
	getChannels() {
		return [
			{ key: 'pan', label: 'Pan (X)', channel: 'x' },
			{ key: 'tilt', label: 'Tilt (Y)', channel: 'y' }
		];
	}
}
