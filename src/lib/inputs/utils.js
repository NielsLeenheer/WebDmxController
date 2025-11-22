/**
 * Input System
 *
 * Utility functions for working with input controls (buttons, sliders, knobs) from MIDI/HID devices
 */

import { toCSSIdentifier } from '../css/utils.js';

/**
 * Check if an input is a button (vs slider/knob)
 * @param {Object} input - Input object
 * @returns {boolean}
 */
export function isButtonInput(input) {
	if (!input.inputControlId) return false;
	// Button controls:
	// - MIDI notes: note-XX
	// - HID/StreamDeck buttons: button-XX or just 'button' (Thingy:52)
	// - Keyboard keys: key-XX
	// - CC/control changes are sliders/knobs
	return input.inputControlId.startsWith('note-') ||
	       input.inputControlId.startsWith('button-') ||
	       input.inputControlId === 'button' ||
	       input.inputControlId.startsWith('key-');
}

/**
 * Get CSS property name for an input (for sliders/knobs)
 * @param {Object} input - Input object
 * @returns {string}
 */
export function getInputPropertyName(input) {
	return input.cssProperty || `--${toCSSIdentifier(input.name)}`;
}
