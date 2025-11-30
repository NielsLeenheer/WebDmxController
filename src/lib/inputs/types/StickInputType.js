import { InputType } from './InputType.js';

/**
 * Stick Input Type
 *
 * Analog stick that combines button press (L3/R3) with X/Y axes.
 * Exports separate X and Y values and supports button triggers.
 */
export class StickInputType extends InputType {
	constructor() {
		super('stick', 'Stick');
	}

	getExportedValues(input) {
		return [
			{
				key: 'x',
				label: 'X Axis',
				cssProperty: input.cssIdentifier ? `--${input.cssIdentifier}-x` : null,
				type: 'range',
				min: -100,
				max: 100,
				unit: '%',
				description: 'Horizontal axis position'
			},
			{
				key: 'y',
				label: 'Y Axis',
				cssProperty: input.cssIdentifier ? `--${input.cssIdentifier}-y` : null,
				type: 'range',
				min: -100,
				max: 100,
				unit: '%',
				description: 'Vertical axis position'
			}
		];
	}

	isButton() {
		return true; // Can be pressed (L3/R3)
	}

	hasValues() {
		return true; // Has X and Y values
	}
}
