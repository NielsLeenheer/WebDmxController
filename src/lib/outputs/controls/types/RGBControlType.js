import { ControlType } from './ControlType.js';
import { CONTROL_VALUE_TYPES } from '../valueTypes.js';

/**
 * RGB Control Type (3 channels: red, green, blue)
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
		if (channel === 'r' || channel === 'red') {
			return { ...CONTROL_VALUE_TYPES.red, channel: 'r' };
		}
		if (channel === 'g' || channel === 'green') {
			return { ...CONTROL_VALUE_TYPES.green, channel: 'g' };
		}
		if (channel === 'b' || channel === 'blue') {
			return { ...CONTROL_VALUE_TYPES.blue, channel: 'b' };
		}
		// Return all channels if no specific channel requested
		return {
			channels: [
				{ ...CONTROL_VALUE_TYPES.red, channel: 'r', key: 'red' },
				{ ...CONTROL_VALUE_TYPES.green, channel: 'g', key: 'green' },
				{ ...CONTROL_VALUE_TYPES.blue, channel: 'b', key: 'blue' }
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
