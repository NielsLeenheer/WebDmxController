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
			sample: true,
			min: -50,
			max: 50,
			unit: '%',
			dmxMin: 0,
			dmxMax: 255,
			description: 'Pan position (-50% to +50%)',
			channel: 'x',
			component: 'Pan'
		};

		const tiltMeta = {
			type: 'range',
			cssProperty: '--tilt',
			sample: true,
			min: 0,
			max: 100,
			unit: '%',
			dmxMin: 0,
			dmxMax: 255,
			description: 'Tilt position (0% to 100%)',
			channel: 'y',
			component: 'Tilt'
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

	getSamplingConfig() {
		const allMeta = this.getValueMetadata();
		const panMeta = allMeta.channels[0];
		const tiltMeta = allMeta.channels[1];

		return {
			properties: [
				{
					cssProperty: panMeta.cssProperty,
					parse: (cssValue) => {
						const match = cssValue.match(/(-?\d+(?:\.\d+)?)/);
						const value = match ? parseFloat(match[1]) : 0;
						const normalized = (value - panMeta.min) / (panMeta.max - panMeta.min);
						const dmxValue = Math.round(normalized * (panMeta.dmxMax - panMeta.dmxMin) + panMeta.dmxMin);
						return { [panMeta.component]: Math.max(panMeta.dmxMin, Math.min(panMeta.dmxMax, dmxValue)) };
					}
				},
				{
					cssProperty: tiltMeta.cssProperty,
					parse: (cssValue) => {
						const match = cssValue.match(/(-?\d+(?:\.\d+)?)/);
						const value = match ? parseFloat(match[1]) : 0;
						const normalized = (value - tiltMeta.min) / (tiltMeta.max - tiltMeta.min);
						const dmxValue = Math.round(normalized * (tiltMeta.dmxMax - tiltMeta.dmxMin) + tiltMeta.dmxMin);
						return { [tiltMeta.component]: Math.max(tiltMeta.dmxMin, Math.min(tiltMeta.dmxMax, dmxValue)) };
					}
				}
			]
		};
	}
}
