import { InputType } from './InputType.js';

/**
 * Button Input Type
 *
 * Momentary or toggle buttons. Does not export continuous values.
 * Used for MIDI notes, HID buttons, Stream Deck buttons.
 */
export class ButtonInputType extends InputType {
	constructor() {
		super('button', 'Button');
	}

	getExportedValues(input) {
		// Buttons don't export continuous values
		return [];
	}

	isButton() {
		return true;
	}
}
