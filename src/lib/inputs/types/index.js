/**
 * Input Types
 *
 * Registry of all input type definitions.
 */

import { InputType } from './InputType.js';
import { ButtonInputType } from './ButtonInputType.js';
import { KeyInputType } from './KeyInputType.js';
import { PadInputType } from './PadInputType.js';
import { KnobInputType } from './KnobInputType.js';
import { SliderInputType } from './SliderInputType.js';
import { ThingyInputType } from './ThingyInputType.js';

// Export classes
export { InputType };
export { ButtonInputType };
export { KeyInputType };
export { PadInputType };
export { KnobInputType };
export { SliderInputType };
export { ThingyInputType };

// Singleton instances for each type
const buttonType = new ButtonInputType();
const keyType = new KeyInputType();
const padType = new PadInputType();
const knobType = new KnobInputType();
const sliderType = new SliderInputType();
const thingyType = new ThingyInputType();

/**
 * Input types registry
 * Maps type ID to input type instance
 */
export const INPUT_TYPES = {
	button: buttonType,
	key: keyType,
	pad: padType,
	knob: knobType,
	slider: sliderType,
	thingy: thingyType
};

/**
 * Get input type instance by ID
 * @param {string} typeId - Input type ID
 * @returns {InputType|null} Input type instance or null if not found
 */
export function getInputType(typeId) {
	return INPUT_TYPES[typeId] || null;
}

/**
 * Get input type for an input based on its properties
 * Determines the correct type based on input device and control ID
 * @param {Object} input - Input object from InputLibrary
 * @returns {InputType} Input type instance
 */
export function getInputTypeForInput(input) {
	// If input has explicit type, use it
	if (input.type && INPUT_TYPES[input.type]) {
		return INPUT_TYPES[input.type];
	}

	const controlId = input.inputControlId || '';

	// Thingy:52 sensors
	if (controlId.startsWith('euler-') ||
		controlId.startsWith('quat-') ||
		controlId.startsWith('accel-') ||
		controlId.startsWith('gyro-') ||
		controlId.startsWith('compass-') ||
		controlId === 'pan' ||
		controlId === 'tilt') {
		return thingyType;
	}

	// Keyboard keys
	if (controlId.startsWith('key-')) {
		return keyType;
	}

	// MIDI notes and buttons
	if (controlId.startsWith('note-') ||
		controlId.startsWith('button-') ||
		controlId === 'button') {
		return buttonType;
	}

	// Default to knob for continuous controllers
	return knobType;
}
