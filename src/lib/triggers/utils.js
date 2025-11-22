/**
 * Trigger System
 *
 * Utility functions for working with triggers that map input events to actions
 */

import { toCSSIdentifier } from '../css/utils.js';
import { DEVICE_TYPES } from '../outputs/devices.js';
import { generateCSSProperties } from '../css/generator.js';

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

/**
 * Generate CSS for animation actions
 * @private
 */
function _generateAnimationCSS(trigger, devices = [], allTriggers = [], animationLibrary = null, inputLibrary = null) {
	if (!trigger.animation?.id) return '';

	// Get device by single deviceId
	const device = devices.find(d => d.id === trigger.deviceId);
	if (!device) return '';

	const targetSelector = `#${device.cssId}`;

	const iterationsValue = trigger.animation.iterations === 'infinite' ? 'infinite' : trigger.animation.iterations;
	const durationSec = (trigger.animation.duration / 1000).toFixed(3);

	// Look up animation to get cssName
	const animation = animationLibrary?.get(trigger.animation.id);
	const animName = animation?.cssName || trigger.animation.id;

	// Build the animation specification for this trigger
	// Use cssName for the animation identifier in CSS
	const thisAnimation = `${animName} ${durationSec}s ${trigger.animation.easing} ${iterationsValue}`;

	// For manual triggers (non-automatic), check for automatic triggers on the same device
	// and prepend their animations to preserve them
	let animationValue = thisAnimation;
	if (trigger.triggerType !== 'always') {
		// Find all automatic triggers that target the same device
		const automaticAnimations = allTriggers
			.filter(t =>
				t.actionType === 'animation' &&
				t.triggerType === 'always' &&
				t.animation?.id &&
				// Check if this automatic trigger targets the same device
				t.deviceId === trigger.deviceId
			)
			.map(t => {
				const iterVal = t.animation.iterations === 'infinite' ? 'infinite' : t.animation.iterations;
				const durSec = (t.animation.duration / 1000).toFixed(3);
				// Look up animation to get cssName
				const anim = animationLibrary?.get(t.animation.id);
				const animName = anim?.cssName || t.animation.id;
				return `${animName} ${durSec}s ${t.animation.easing} ${iterVal}`;
			});

		// Combine automatic animations with this animation
		if (automaticAnimations.length > 0) {
			animationValue = [...automaticAnimations, thisAnimation].join(', ');
		}
	}

	// For automatic triggers (always), don't use a class selector
	// For input triggers, use the class selector
	const cssClassName = getCSSClassName(trigger, inputLibrary);
	const selector = trigger.triggerType === 'always'
		? targetSelector
		: `.${cssClassName} ${targetSelector}`;

	return `${selector} {
  animation: ${animationValue};
}`;
}

/**
 * Generate CSS for setValue/values actions
 * @private
 */
function _generateSetValueCSS(trigger, devices = [], inputLibrary = null) {
	if (!trigger.deviceId || !trigger.values) return '';

	// Find the target device
	const device = devices.find(d => d.id === trigger.deviceId);
	if (!device) return '';

	// Get device type to access controls/components
	const deviceType = DEVICE_TYPES[device.type];
	if (!deviceType) return '';

	// Convert channelValues object to array format
	const valuesArray = new Array(deviceType.channels).fill(0);
	for (const [channelStr, value] of Object.entries(trigger.values.channelValues)) {
		const channel = parseInt(channelStr);
		if (channel < valuesArray.length) {
			valuesArray[channel] = value;
		}
	}

	// Filter controls to only include enabled ones
	const filteredControls = Array.isArray(trigger.values.enabledControls)
		? deviceType.controls.filter(control =>
			trigger.values.enabledControls.includes(control.name)
		)
		: deviceType.controls;

	// Generate CSS properties only for enabled controls
	const properties = generateCSSProperties(
		filteredControls,
		deviceType.components,
		valuesArray,
		device.type
	);

	if (Object.keys(properties).length === 0) return '';

	// Convert properties object to CSS string
	const props = Object.entries(properties).map(([prop, value]) => `  ${prop}: ${value};`);

	const cssClassName = getCSSClassName(trigger, inputLibrary);
	const selector = `.${cssClassName} #${device.cssId}`;

	return `${selector} {
${props.join('\n')}
}`;
}

/**
 * Generate CSS for a trigger
 * @param {Object} trigger - Trigger object
 * @param {Array} devices - Array of device objects
 * @param {Array} allTriggers - Array of all trigger objects
 * @param {Object} animationLibrary - AnimationLibrary instance to resolve animation cssNames
 * @param {Object} inputLibrary - InputLibrary instance to resolve input names
 * @returns {string} CSS string
 */
export function toCSS(trigger, devices = [], allTriggers = [], animationLibrary = null, inputLibrary = null) {
	if (trigger.actionType === 'animation') {
		return _generateAnimationCSS(trigger, devices, allTriggers, animationLibrary, inputLibrary);
	} else if (trigger.actionType === 'values' || trigger.actionType === 'setValue') {
		return _generateSetValueCSS(trigger, devices, inputLibrary);
	}
	return '';
}
