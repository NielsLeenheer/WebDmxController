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
	return trigger.type === 'auto';
}

/**
 * Check if trigger is manual (input-based action trigger)
 * @param {Object} trigger - Trigger object
 * @returns {boolean}
 */
export function isManual(trigger) {
	return trigger.type === 'action';
}

/**
 * Check if trigger is a value-based trigger (continuous input-to-control mapping)
 * @param {Object} trigger - Trigger object
 * @returns {boolean}
 */
export function isValueTrigger(trigger) {
	return trigger.type === 'value';
}

/**
 * Generate CSS class name from trigger and input
 * @param {Object} trigger - Trigger object
 * @param {Object} inputLibrary - InputLibrary instance to resolve input
 * @returns {string} CSS class name
 */
export function getCSSClassName(trigger, inputLibrary) {
	// For automatic (always) triggers
	if (trigger.type === 'auto') {
		return 'always';
	}

	// For action triggers - get input from library
	if (!inputLibrary || !trigger.input?.id) {
		return `trigger-${trigger.id || 'unknown'}`;
	}

	const input = inputLibrary.get(trigger.input.id);
	if (!input) {
		return `trigger-${trigger.id || 'unknown'}`;
	}

	// Derive CSS class name from input's cssIdentifier and input.state
	const cssId = input.cssIdentifier;
	const state = trigger.input.state || 'down';
	
	return `${cssId}-${state}`;
}
