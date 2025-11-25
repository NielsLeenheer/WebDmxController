import { InputType } from './InputType.js';

/**
 * Pad Input Type
 *
 * Pressure-sensitive pads that export pressure/velocity.
 * Used for MIDI drum pads and velocity-sensitive buttons.
 */
export class PadInputType extends InputType {
	constructor() {
		super('pad', 'Pad');
	}

	getExportedValues(input) {
		return [
			{
				key: 'pressure',
				label: 'Pressure',
				cssProperty: input.cssProperty ? `${input.cssProperty}-pressure` : null,
				type: 'range',
				min: 0,
				max: 100,
				unit: '%',
				description: 'Pad pressure (velocity)'
			}
		];
	}

	isButton() {
		return true;
	}

	isContinuous() {
		return true;
	}
}
