import { InputType } from './InputType.js';

/**
 * Key Input Type
 *
 * Keyboard keys. Does not export continuous values.
 * Used for keyboard shortcuts and hotkeys.
 */
export class KeyInputType extends InputType {
	constructor() {
		super('key', 'Key');
	}

	getExportedValues(input) {
		// Keys don't export continuous values
		return [];
	}

	isButton() {
		return true;
	}
}
