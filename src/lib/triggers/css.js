/**
 * CSS Generation for Triggers
 *
 * Functions for converting triggers to CSS rules
 */

import { getProperties } from '../outputs/css.js';
import { DEVICE_TYPES } from '../outputs/devices.js';
import { getCSSClassName } from './utils.js';
import { getInputExportedValues, INPUT_VALUE_TYPES } from '../inputs/valueTypes.js';

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

/**
 * Generate CSS for a value-based trigger
 * Maps an input value to a device control continuously
 *
 * @param {Object} trigger - Value trigger object
 * @param {Object} device - Target device object
 * @param {Object} inputLibrary - InputLibrary instance
 * @returns {string} CSS rule for the value mapping
 */
export function generateValueTriggerCSS(trigger, device, inputLibrary) {
	if (!trigger || !device || !inputLibrary) return '';
	if (trigger.triggerType !== 'value') return '';

	// Get input and its exported values
	const input = inputLibrary.get(trigger.inputId);
	if (!input) return '';

	const exportedValues = getInputExportedValues(input);
	const inputValue = exportedValues.find(v => v.key === trigger.inputValueKey);
	if (!inputValue || !inputValue.cssProperty) return '';

	// Get device type and control
	const deviceType = DEVICE_TYPES[device.type];
	if (!deviceType) return '';

	const controlDef = deviceType.controls.find(c => c.name === trigger.controlName);
	if (!controlDef) return '';

	// Get control metadata for the specific channel (or single-channel control)
	const controlMeta = controlDef.type.getValueMetadata(
		trigger.controlName,
		trigger.controlChannel
	);
	if (!controlMeta) return '';

	// Get input value type metadata
	const inputTypeMeta = INPUT_VALUE_TYPES[inputValue.valueType];
	if (!inputTypeMeta) return '';

	// Build the CSS property and value
	const inputCssProperty = inputValue.cssProperty;
	const outputCssProperty = controlMeta.cssProperty;

	if (!outputCssProperty) {
		// Control doesn't have a direct CSS property (e.g., individual RGB channels)
		// Skip for now - could be extended to support rgb() building
		return '';
	}

	// Determine input and output ranges (use overrides if provided)
	const inputMin = trigger.inputMin ?? inputTypeMeta.min;
	const inputMax = trigger.inputMax ?? inputTypeMeta.max;
	const outputMin = trigger.outputMin ?? controlMeta.min;
	const outputMax = trigger.outputMax ?? controlMeta.max;
	const inputUnit = inputTypeMeta.unit || '';
	const outputUnit = controlMeta.unit || '';

	// Handle inversion
	const effectiveOutputMin = trigger.invert ? outputMax : outputMin;
	const effectiveOutputMax = trigger.invert ? outputMin : outputMax;

	// Generate the CSS calc() expression
	const cssValue = _generateCalcExpression(
		inputCssProperty,
		inputMin,
		inputMax,
		inputUnit,
		effectiveOutputMin,
		effectiveOutputMax,
		outputUnit
	);

	// Build the selector - value triggers are always active
	const selector = `#${device.cssId}`;

	return `/* Value trigger: ${input.name} → ${device.name || device.cssId} ${trigger.controlName}${trigger.controlChannel ? ` (${trigger.controlChannel})` : ''} */
${selector} {
  ${outputCssProperty}: ${cssValue};
}`;
}

/**
 * Generate a CSS calc() expression for value conversion
 * @private
 */
function _generateCalcExpression(
	inputProperty,
	inputMin,
	inputMax,
	inputUnit,
	outputMin,
	outputMax,
	outputUnit
) {
	const inputRange = inputMax - inputMin;
	const outputRange = outputMax - outputMin;

	// Special case: direct mapping when ranges and units match
	if (inputMin === outputMin && inputMax === outputMax && inputUnit === outputUnit) {
		return `var(${inputProperty})`;
	}

	// Special case: percentage input to different percentage output
	if (inputUnit === '%' && outputUnit === '%' && inputMin === 0 && inputMax === 100) {
		// Input is 0-100%
		if (outputMin === 0 && outputMax === 100) {
			// Direct mapping
			return `var(${inputProperty})`;
		}
		if (outputMin === -50 && outputMax === 50) {
			// 0-100% to -50% to 50%: subtract 50
			return `calc(var(${inputProperty}) - 50%)`;
		}
		// General: scale and offset
		const scale = outputRange / 100;
		if (scale === 1) {
			return `calc(var(${inputProperty}) + ${outputMin}${outputUnit})`;
		}
		return `calc(var(${inputProperty}) * ${scale} + ${outputMin}${outputUnit})`;
	}

	// Special case: degree input to percentage output
	if (inputUnit === 'deg' && outputUnit === '%') {
		// e.g., -180deg to 180deg → 0% to 100%
		// Formula: (value - inputMin) / inputRange * outputRange + outputMin
		// With CSS: calc((var(--input) - inputMin) / inputRange * outputRange + outputMin)
		if (inputMin === -180 && inputMax === 180 && outputMin === 0 && outputMax === 100) {
			// (val + 180deg) / 360deg * 100%
			return `calc((var(${inputProperty}) + 180deg) / 360deg * 100%)`;
		}
		if (inputMin === -180 && inputMax === 180 && outputMin === -50 && outputMax === 50) {
			// (val + 180deg) / 360deg * 100% - 50%
			return `calc((var(${inputProperty}) + 180deg) / 360deg * 100% - 50%)`;
		}
		if (inputMin === -90 && inputMax === 90 && outputMin === 0 && outputMax === 100) {
			// Tilt: (val + 90deg) / 180deg * 100%
			return `calc((var(${inputProperty}) + 90deg) / 180deg * 100%)`;
		}
	}

	// Special case: percentage input to unitless output (0-100% to 0-1)
	if (inputUnit === '%' && outputUnit === '' && inputMin === 0 && inputMax === 100) {
		if (outputMin === 0 && outputMax === 1) {
			// 0-100% to 0-1: divide by 100
			return `calc(var(${inputProperty}) / 100%)`;
		}
		if (outputMin === 0 && outputMax === 255) {
			// 0-100% to 0-255
			return `calc(var(${inputProperty}) / 100% * 255)`;
		}
	}

	// General case: normalize input to 0-1, then scale to output
	// CSS calc has limitations with mixed units, so we try to produce valid CSS

	// If units are different, we need careful handling
	if (inputUnit !== outputUnit) {
		// This is complex - try a reasonable approximation
		// Assume input comes as a numeric value with unit
		if (inputUnit === '' && outputUnit === '%') {
			// Unitless to percentage
			const scale = outputRange / inputRange * 100;
			const offset = outputMin - (inputMin / inputRange * outputRange);
			return `calc(var(${inputProperty}) * ${scale / inputRange}% + ${offset}%)`;
		}
	}

	// Same unit - straightforward linear transformation
	// y = (x - inputMin) / inputRange * outputRange + outputMin
	const scale = outputRange / inputRange;

	if (inputMin === 0 && outputMin === 0) {
		// Simple scaling
		if (scale === 1) {
			return `var(${inputProperty})`;
		}
		return `calc(var(${inputProperty}) * ${scale})`;
	}

	// Full transformation
	const offset = outputMin - (inputMin * scale);
	if (offset === 0) {
		return `calc(var(${inputProperty}) * ${scale})`;
	}
	if (scale === 1) {
		return `calc(var(${inputProperty}) + ${offset}${outputUnit})`;
	}
	return `calc(var(${inputProperty}) * ${scale} + ${offset}${outputUnit})`;
}
