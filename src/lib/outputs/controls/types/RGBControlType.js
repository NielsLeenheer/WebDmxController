import { ControlType } from './ControlType.js';

/**
 * RGB Control Type (3 channels: red, green, blue)
 *
 * Subclasses should override getValueMetadata() with control-specific metadata.
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
	 * Get value metadata for this RGB control.
	 * Subclasses should override this with control-specific metadata.
	 * This provides a generic fallback for R/G/B channels.
	 *
	 * @param {string|null} channel - 'r'/'red', 'g'/'green', or 'b'/'blue'
	 * @returns {Object} Value metadata
	 */
	getValueMetadata(channel = null) {
		const redMeta = {
			type: 'range',
			cssProperty: '--red',
			sample: false, // Sampled from combined 'color' property
			min: 0,
			max: 255,
			unit: '',
			dmxMin: 0,
			dmxMax: 255,
			description: 'Red channel (0-255)',
			channel: 'r',
			component: 'Red'
		};

		const greenMeta = {
			type: 'range',
			cssProperty: '--green',
			sample: false, // Sampled from combined 'color' property
			min: 0,
			max: 255,
			unit: '',
			dmxMin: 0,
			dmxMax: 255,
			description: 'Green channel (0-255)',
			channel: 'g',
			component: 'Green'
		};

		const blueMeta = {
			type: 'range',
			cssProperty: '--blue',
			sample: false, // Sampled from combined 'color' property
			min: 0,
			max: 255,
			unit: '',
			dmxMin: 0,
			dmxMax: 255,
			description: 'Blue channel (0-255)',
			channel: 'b',
			component: 'Blue'
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

		return {
			channels: [
				{ ...redMeta, key: 'red' },
				{ ...greenMeta, key: 'green' },
				{ ...blueMeta, key: 'blue' }
			]
		};
	}

	getSamplingConfig() {
		return {
			cssProperty: 'color',
			parse: (cssValue) => {
				const match = cssValue.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
				if (!match) return null;
				return {
					Red: parseInt(match[1]),
					Green: parseInt(match[2]),
					Blue: parseInt(match[3])
				};
			}
		};
	}

	/**
	 * Get available channels for this control type.
	 * Subclasses should override for custom channel labels.
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
