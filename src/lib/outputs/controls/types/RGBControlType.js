import { ControlType } from './ControlType.js';

/**
 * RGB Control Type (3 channels: red, green, blue)
 *
 * Value metadata is defined inline for each color channel.
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

	/**
	 * Get value metadata for this RGB control
	 * @param {string} controlName - Name of the control instance
	 * @param {string|null} channel - 'r'/'red', 'g'/'green', or 'b'/'blue'
	 * @returns {Object} Value metadata
	 */
	getValueMetadata(controlName, channel = null) {
		// Red channel: 0-255
		const redMeta = {
			cssProperty: null, // Part of color property, no individual CSS property
			min: 0,
			max: 255,
			unit: '',
			dmxMin: 0,
			dmxMax: 255,
			description: 'Red channel (0-255)',
			channel: 'r'
		};

		// Green channel: 0-255
		const greenMeta = {
			cssProperty: null,
			min: 0,
			max: 255,
			unit: '',
			dmxMin: 0,
			dmxMax: 255,
			description: 'Green channel (0-255)',
			channel: 'g'
		};

		// Blue channel: 0-255
		const blueMeta = {
			cssProperty: null,
			min: 0,
			max: 255,
			unit: '',
			dmxMin: 0,
			dmxMax: 255,
			description: 'Blue channel (0-255)',
			channel: 'b'
		};

		if (channel === 'r' || channel === 'red') {
			return redMeta;
		}
		if (channel === 'g' || channel === 'green') {
			return greenMeta;
		}
		if (channel === 'b' || channel === 'blue') {
			return blueMeta;
		}

		// Return all channels if no specific channel requested
		return {
			channels: [
				{ ...redMeta, key: 'red' },
				{ ...greenMeta, key: 'green' },
				{ ...blueMeta, key: 'blue' }
			]
		};
	}

	/**
	 * Get available channels for this control type
	 * @returns {Array} Array of channel definitions
	 */
	getChannels() {
		return [
			{ key: 'red', label: 'Red', channel: 'r' },
			{ key: 'green', label: 'Green', channel: 'g' },
			{ key: 'blue', label: 'Blue', channel: 'b' }
		];
	}
}
