import { ControlType } from './types/ControlType.js';

/**
 * ILDA Control
 *
 * A non-DMX control that represents an ILDA laser DAC connection.
 * Consumes zero DMX channels. The device card renders connect/disconnect
 * and calibration UI for this control.
 *
 * The ILDA control enables SVG geometry sampling → Helios DAC output
 * on the device that includes it.
 */
export class ILDAControl extends ControlType {
	constructor() {
		super({
			id: 'ilda',
			name: 'ILDA',
			type: 'ilda',
			defaultValue: null
		});
	}

	getChannelCount() {
		return 0;
	}

	valueToDMX() {
		return [];
	}

	dmxToValue() {
		return null;
	}

	getValueMetadata() {
		return { values: [] };
	}

	getSamplingConfig() {
		return null;
	}
}
