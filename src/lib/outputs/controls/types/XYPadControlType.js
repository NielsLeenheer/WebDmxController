import { ControlType } from './ControlType.js';
import { CONTROL_VALUE_TYPES } from '../valueTypes.js';

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

	/**
	 * Get value metadata for this XY pad control
	 * @param {string} controlName - Name of the control instance
	 * @param {string|null} channel - 'pan'/'x' or 'tilt'/'y'
	 * @returns {Object} Value metadata
	 */
	getValueMetadata(controlName, channel = null) {
		if (channel === 'pan' || channel === 'x') {
			return { ...CONTROL_VALUE_TYPES.pan, channel: 'x' };
		}
		if (channel === 'tilt' || channel === 'y') {
			return { ...CONTROL_VALUE_TYPES.tilt, channel: 'y' };
		}
		// Return both channels if no specific channel requested
		return {
			channels: [
				{ ...CONTROL_VALUE_TYPES.pan, channel: 'x', key: 'pan' },
				{ ...CONTROL_VALUE_TYPES.tilt, channel: 'y', key: 'tilt' }
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
