import { ControlType } from './ControlType.js';

/**
 * XY Pad Control Type (2 channels: x, y)
 * Used for Pan/Tilt on 8-bit devices
 *
 * Value metadata is defined inline for pan and tilt channels.
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
