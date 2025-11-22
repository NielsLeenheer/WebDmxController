/**
 * Trigger System
 *
 * Utility functions for working with triggers that map input events to actions
 */

import { toCSSIdentifier } from '../css/utils.js';

/**
 * Check if trigger is automatic (always-running)
 * @param {Object} trigger - Trigger object
 * @returns {boolean}
 */
export function isAutomatic(trigger) {
	return trigger.triggerType === 'always';
}

/**
 * Check if trigger is manual (input-based)
 * @param {Object} trigger - Trigger object
 * @returns {boolean}
 */
export function isManual(trigger) {
	return !isAutomatic(trigger);
}

/**
 * Generate CSS class name from trigger and input
 * @param {Object} trigger - Trigger object
 * @param {Object} inputLibrary - InputLibrary instance to resolve input
 * @returns {string} CSS class name
 */
export function getCSSClassName(trigger, inputLibrary) {
	// For automatic (always) triggers
	if (trigger.triggerType === 'always') {
		return 'always';
	}

	// For manual triggers - get input from library
	if (!inputLibrary || !trigger.inputId) {
		return `trigger-${trigger.id || 'unknown'}`;
	}

	const input = inputLibrary.get(trigger.inputId);
	if (!input) {
		return `trigger-${trigger.id || 'unknown'}`;
	}

	// Use the input's CSS classes based on trigger type and button mode
	const buttonMode = input.buttonMode || 'momentary';
	
	if (buttonMode === 'toggle') {
		return trigger.triggerType === 'pressed' ? input.cssClassOn : input.cssClassOff;
	} else {
		return trigger.triggerType === 'pressed' ? input.cssClassDown : input.cssClassUp;
	}
}
