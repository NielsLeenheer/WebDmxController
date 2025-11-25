import { XYPadControlType } from './types/XYPadControlType.js';

/**
 * Pan/Tilt Control (8-bit)
 * Controls position for moving head fixtures (standard precision)
 */
export class PanTiltControl extends XYPadControlType {
	constructor() {
		super('pantilt', 'Pan/Tilt');
	}

	getValueMetadata(channel = null) {
		const panMeta = {
			type: 'range',
			cssProperty: '--pan',
			min: -50,
			max: 50,
			unit: '%',
			dmxMin: 0,
			dmxMax: 255,
			description: 'Pan position (-50% to +50%)',
			channel: 'x'
		};

		const tiltMeta = {
			type: 'range',
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
