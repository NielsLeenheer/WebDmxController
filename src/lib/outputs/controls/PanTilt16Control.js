import { XYPad16ControlType } from './types/XYPad16ControlType.js';

/**
 * Pan/Tilt Control (16-bit)
 * Controls position for moving head fixtures (high precision)
 */
export class PanTilt16Control extends XYPad16ControlType {
	constructor() {
		super({
			id: 'pantilt16',
			name: 'Pan/Tilt',
		});
	}

	getValueMetadata() {
		const panMeta = {
			id: 'pan',
			label: 'Pan',
			type: 'range',
			cssProperty: '--pan',
			sample: true,
			min: -50,
			max: 50,
			unit: '%',
			dmxMin: 0,
			dmxMax: 65535,
			description: 'Pan position (-50% to +50%)'
		};

		const tiltMeta = {
			id: 'tilt',
			label: 'Tilt',
			type: 'range',
			cssProperty: '--tilt',
			sample: true,
			min: 0,
			max: 100,
			unit: '%',
			dmxMin: 0,
			dmxMax: 65535,
			description: 'Tilt position (0% to 100%)'
		};

		return {
			values: [panMeta, tiltMeta]
		};
	}

	getSamplingConfig() {
		const allMeta = this.getValueMetadata();
		const panMeta = allMeta.values[0];
		const tiltMeta = allMeta.values[1];

		return {
			properties: [
				{
					cssProperty: panMeta.cssProperty,
					parse: (cssValue) => {
						const match = cssValue.match(/(-?\d+(?:\.\d+)?)/);
						const value = match ? parseFloat(match[1]) : 0;
						const normalized = (value - panMeta.min) / (panMeta.max - panMeta.min);
						const dmxValue = Math.round(normalized * (panMeta.dmxMax - panMeta.dmxMin) + panMeta.dmxMin);
						return { pan: Math.max(panMeta.dmxMin, Math.min(panMeta.dmxMax, dmxValue)) };
					}
				},
				{
					cssProperty: tiltMeta.cssProperty,
					parse: (cssValue) => {
						const match = cssValue.match(/(-?\d+(?:\.\d+)?)/);
						const value = match ? parseFloat(match[1]) : 0;
						const normalized = (value - tiltMeta.min) / (tiltMeta.max - tiltMeta.min);
						const dmxValue = Math.round(normalized * (tiltMeta.dmxMax - tiltMeta.dmxMin) + tiltMeta.dmxMin);
						return { tilt: Math.max(tiltMeta.dmxMin, Math.min(tiltMeta.dmxMax, dmxValue)) };
					}
				}
			]
		};
	}
}
