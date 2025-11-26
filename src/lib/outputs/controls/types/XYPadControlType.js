import { ControlType } from './ControlType.js';

/**
 * XY Pad Control Type (2 channels: x, y)
 * Used for Pan/Tilt on 8-bit devices
 *
 * Subclasses should override getValueMetadata() with control-specific metadata.
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

	/**
	 * Get value metadata for this XY pad control.
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
