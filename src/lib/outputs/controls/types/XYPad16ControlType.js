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
	 * Get value metadata for this 16-bit XY pad control.
	 * Subclasses should override this with control-specific metadata.
	 * This provides a generic fallback for X/Y channels.
	 *
	 * @param {string|null} channel - 'x' or 'y'
	 * @returns {Object} Value metadata
	 */
	getValueMetadata(channel = null) {
		const xMeta = {
			type: 'range',
			cssProperty: `--${this.id}-x`,
			sample: true,
			min: 0,
			max: 255,
			unit: '',
			dmxMin: 0,
			dmxMax: 255,
			description: `${this.name} X axis (0-255)`,
			channel: 'x',
			component: `${this.name}X`
		};

		const yMeta = {
			type: 'range',
			cssProperty: `--${this.id}-y`,
			sample: true,
			min: 0,
			max: 255,
			unit: '',
			dmxMin: 0,
			dmxMax: 255,
			description: `${this.name} Y axis (0-255)`,
			channel: 'y',
			component: `${this.name}Y`
		};

		if (channel === 'x') {
			return xMeta;
		}
		if (channel === 'y') {
			return yMeta;
		}

		return {
			channels: [
				{ ...xMeta, key: 'x' },
				{ ...yMeta, key: 'y' }
			]
		};
	}

	getSamplingConfig() {
		const allMeta = this.getValueMetadata();
		const xMeta = allMeta.channels[0];
		const yMeta = allMeta.channels[1];

		return {
			properties: [
				{
					cssProperty: xMeta.cssProperty,
					parse: (cssValue) => {
						const match = cssValue.match(/(-?\d+(?:\.\d+)?)/);
						const value = match ? parseFloat(match[1]) : 0;
						const normalized = (value - xMeta.min) / (xMeta.max - xMeta.min);
						const dmxValue = Math.round(normalized * (xMeta.dmxMax - xMeta.dmxMin) + xMeta.dmxMin);
						return { [xMeta.component]: Math.max(xMeta.dmxMin, Math.min(xMeta.dmxMax, dmxValue)) };
					}
				},
				{
					cssProperty: yMeta.cssProperty,
					parse: (cssValue) => {
						const match = cssValue.match(/(-?\d+(?:\.\d+)?)/);
						const value = match ? parseFloat(match[1]) : 0;
						const normalized = (value - yMeta.min) / (yMeta.max - yMeta.min);
						const dmxValue = Math.round(normalized * (yMeta.dmxMax - yMeta.dmxMin) + yMeta.dmxMin);
						return { [yMeta.component]: Math.max(yMeta.dmxMin, Math.min(yMeta.dmxMax, dmxValue)) };
					}
				}
			]
		};
	}

	/**
	 * Get available channels for this control type.
	 * Subclasses should override for custom channel labels.
	 * @returns {Array} Array of channel definitions
	 */
	getChannels() {
		return [
			{ key: 'x', label: 'X', channel: 'x' },
			{ key: 'y', label: 'Y', channel: 'y' }
		];
	}
}
