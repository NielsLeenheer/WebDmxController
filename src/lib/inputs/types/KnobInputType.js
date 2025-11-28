import { InputType } from './InputType.js';

/**
 * Knob Input Type
 *
 * Rotary encoders and continuous controllers.
 * Exports a single value from 0-100%.
 */
export class KnobInputType extends InputType {
	constructor() {
		super('knob', 'Knob');
	}

	getExportedValues(input) {
		return [
			{
				key: 'value',
				label: 'Value',
				cssProperty: input.cssIdentifier ? `--${input.cssIdentifier}` : null,
				type: 'range',
				min: 0,
				max: 100,
				unit: '%',
				description: 'Knob position (0-100%)'
			}
		];
	}

	hasValues() {
		return true;
	}
}
