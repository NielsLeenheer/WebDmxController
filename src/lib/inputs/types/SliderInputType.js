import { InputType } from './InputType.js';

/**
 * Slider Input Type
 *
 * Linear faders and sliders.
 * Exports a single value from 0-100%.
 */
export class SliderInputType extends InputType {
	constructor() {
		super('slider', 'Slider');
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
				description: 'Slider position (0-100%)'
			}
		];
	}

	hasValues() {
		return true;
	}
}
