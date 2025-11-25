import { XYPad16ControlType } from './types/XYPad16ControlType.js';

/**
 * Pan/Tilt Control (16-bit)
 * Controls position for moving head fixtures (high precision)
 */
export class PanTilt16Control extends XYPad16ControlType {
	constructor() {
		super('pantilt16', 'Pan/Tilt');
	}

	getValueMetadata(channel = null) {
		const panMeta = {
			cssProperty: '--pan',
			min: -50,
			max: 50,
			unit: '%',
			dmxMin: 0,
			dmxMax: 65535,
			description: 'Pan position (-50% to +50%)',
			channel: 'x'
		};

		const tiltMeta = {
			cssProperty: '--tilt',
			min: 0,
			max: 100,
			unit: '%',
			dmxMin: 0,
			dmxMax: 65535,
			description: 'Tilt position (0% to 100%)',
			channel: 'y'
		};

		if (channel === 'pan' || channel === 'x') {
			return panMeta;
		}
		if (channel === 'tilt' || channel === 'y') {
			return tiltMeta;
		}

		return {
			channels: [
				{ ...panMeta, key: 'pan' },
				{ ...tiltMeta, key: 'tilt' }
			]
		};
	}

	getChannels() {
		return [
			{ key: 'pan', label: 'Pan (X)', channel: 'x' },
			{ key: 'tilt', label: 'Tilt (Y)', channel: 'y' }
		];
	}
}
