/**
 * CSS Generation for Triggers
 *
 * Functions for converting triggers to CSS rules
 */

import { getProperties } from '../outputs/css.js';
import { DEVICE_TYPES } from '../outputs/devices.js';
import { getCSSClassName } from './utils.js';

/**
 * Generate CSS for all triggers targeting a specific device
 * @param {Object} device - Device object
 * @param {Array} allTriggers - All trigger objects
 * @param {Object} animationLibrary - AnimationLibrary instance
 * @param {Object} inputLibrary - InputLibrary instance
 * @returns {string} CSS rules for this device
 */
export function generateCSSTriggers(device, allTriggers, animationLibrary, inputLibrary) {
	const cssRules = [];
	
	// Get all triggers for this device
	const deviceTriggers = allTriggers.filter(t => t.deviceId === device.id);
	
	// Separate automatic and manual triggers
	const automaticTriggers = deviceTriggers.filter(t => t.triggerType === 'always');
	const manualTriggers = deviceTriggers.filter(t => t.triggerType !== 'always');
	
	// Generate CSS for automatic triggers (combined)
	if (automaticTriggers.length > 0) {
		const css = _generateAutomaticTriggersCSS(device, automaticTriggers, animationLibrary);
		if (css) cssRules.push(css);
	}
	
	// Generate CSS for each manual trigger
	for (const trigger of manualTriggers) {
		const css = _generateManualTriggerCSS(device, trigger, automaticTriggers, animationLibrary, inputLibrary);
		if (css) cssRules.push(css);
	}
	
	return cssRules.join('\n\n');
}

/**
 * Generate CSS for automatic (always-running) triggers on a device
 * @private
 */
function _generateAutomaticTriggersCSS(device, automaticTriggers, animationLibrary) {
	// Only handle animation triggers for automatic
	const animationTriggers = automaticTriggers.filter(t => 
		t.actionType === 'animation' && t.animation?.id
	);
	
	if (animationTriggers.length === 0) return '';
	
	// Combine all automatic animations for this device
	const animationSpecs = animationTriggers.map(trigger => {
		const iterVal = trigger.animation.iterations === 'infinite' 
			? 'infinite' 
			: trigger.animation.iterations;
		const durSec = (trigger.animation.duration / 1000).toFixed(3);
		
		// Look up animation to get cssName
		const animation = animationLibrary?.get(trigger.animation.id);
		const animName = animation?.cssName || trigger.animation.id;
		
		return `${animName} ${durSec}s ${trigger.animation.easing} ${iterVal}`;
	});
	
	const animationValue = animationSpecs.join(', ');
	
	return `#${device.cssId} {
  animation: ${animationValue};
}`;
}

/**
 * Generate CSS for a manual (input-triggered) trigger on a device
 * @private
 */
function _generateManualTriggerCSS(device, trigger, automaticTriggers, animationLibrary, inputLibrary) {
	if (trigger.actionType === 'animation') {
		return _generateManualAnimationCSS(device, trigger, automaticTriggers, animationLibrary, inputLibrary);
	} else if (trigger.actionType === 'values') {
		return _generateManualValuesCSS(device, trigger, inputLibrary);
	}
	return '';
}

/**
 * Generate CSS for manual animation trigger
 * @private
 */
function _generateManualAnimationCSS(device, trigger, automaticTriggers, animationLibrary, inputLibrary) {
	if (!trigger.animation?.id) return '';
	
	const iterationsValue = trigger.animation.iterations === 'infinite' 
		? 'infinite' 
		: trigger.animation.iterations;
	const durationSec = (trigger.animation.duration / 1000).toFixed(3);
	
	// Look up animation to get cssName
	const animation = animationLibrary?.get(trigger.animation.id);
	const animName = animation?.cssName || trigger.animation.id;
	
	// Build the animation specification for this trigger
	const thisAnimation = `${animName} ${durationSec}s ${trigger.animation.easing} ${iterationsValue}`;
	
	// Get automatic animations for this device to preserve them
	const automaticAnimationSpecs = automaticTriggers
		.filter(t => t.actionType === 'animation' && t.animation?.id)
		.map(t => {
			const iterVal = t.animation.iterations === 'infinite' ? 'infinite' : t.animation.iterations;
			const durSec = (t.animation.duration / 1000).toFixed(3);
			const anim = animationLibrary?.get(t.animation.id);
			const animName = anim?.cssName || t.animation.id;
			return `${animName} ${durSec}s ${t.animation.easing} ${iterVal}`;
		});
	
	// Combine automatic animations with this animation
	const animationValue = automaticAnimationSpecs.length > 0
		? [...automaticAnimationSpecs, thisAnimation].join(', ')
		: thisAnimation;
	
	const cssClassName = getCSSClassName(trigger, inputLibrary);
	const selector = `.${cssClassName} #${device.cssId}`;
	
	return `${selector} {
  animation: ${animationValue};
}`;
}

/**
 * Generate CSS for manual values trigger
 *
 * NEW: Works with control-based values
 *
 * @private
 */
function _generateManualValuesCSS(device, trigger, inputLibrary) {
	if (!trigger.values) return '';

	// Get device type
	const deviceType = DEVICE_TYPES[device.type];
	if (!deviceType) return '';

	// NEW: trigger.values is now a control values object
	// Filter controls to only those present in trigger.values (implicit enabling)
	const filteredControls = deviceType.controls.filter(control =>
		trigger.values.hasOwnProperty(control.name)
	);

	// Generate CSS properties from control values
	const properties = getProperties(trigger.values, filteredControls);

	if (Object.keys(properties).length === 0) return '';

	// Convert properties object to CSS string
	const props = Object.entries(properties)
		.map(([prop, value]) => `  ${prop}: ${value};`)
		.join('\n');

	const cssClassName = getCSSClassName(trigger, inputLibrary);
	const selector = `.${cssClassName} #${device.cssId}`;

	return `${selector} {
${props}
}`;
}
