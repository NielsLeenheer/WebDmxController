/**
 * CSS Generation for Triggers
 *
 * Functions for converting triggers to CSS rules
 */

import { getProperties } from '../outputs/css.js';
import { DEVICE_TYPES } from '../outputs/devices.js';
import { getCSSClassName } from './utils.js';
import { getInputExportedValues } from '../inputs/valueTypes.js';

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
		
		// Look up animation to get cssIdentifier
		const animation = animationLibrary?.get(trigger.animation.id);
		const animName = animation?.cssIdentifier || trigger.animation.id;
		
		return `${animName} ${durSec}s ${trigger.animation.easing} ${iterVal}`;
	});
	
	const animationValue = animationSpecs.join(', ');
	
	return `#${device.cssIdentifier} {
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
	
	// Look up animation to get cssIdentifier
	const animation = animationLibrary?.get(trigger.animation.id);
	const animName = animation?.cssIdentifier || trigger.animation.id;
	
	// Build the animation specification for this trigger
	const thisAnimation = `${animName} ${durationSec}s ${trigger.animation.easing} ${iterationsValue}`;
	
	// Get automatic animations for this device to preserve them
	const automaticAnimationSpecs = automaticTriggers
		.filter(t => t.actionType === 'animation' && t.animation?.id)
		.map(t => {
			const iterVal = t.animation.iterations === 'infinite' ? 'infinite' : t.animation.iterations;
			const durSec = (t.animation.duration / 1000).toFixed(3);
			const anim = animationLibrary?.get(t.animation.id);
			const animName = anim?.cssIdentifier || t.animation.id;
			return `${animName} ${durSec}s ${t.animation.easing} ${iterVal}`;
		});
	
	// Combine automatic animations with this animation
	const animationValue = automaticAnimationSpecs.length > 0
		? [...automaticAnimationSpecs, thisAnimation].join(', ')
		: thisAnimation;
	
	const cssClassName = getCSSClassName(trigger, inputLibrary);
	const selector = `.${cssClassName} #${device.cssIdentifier}`;
	
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
		trigger.values.hasOwnProperty(control.id)
	);

	// Generate CSS properties from control values
	const properties = getProperties(trigger.values, filteredControls);

	if (Object.keys(properties).length === 0) return '';

	// Convert properties object to CSS string
	const props = Object.entries(properties)
		.map(([prop, value]) => `  ${prop}: ${value};`)
		.join('\n');

	const cssClassName = getCSSClassName(trigger, inputLibrary);
	const selector = `.${cssClassName} #${device.cssIdentifier}`;

	return `${selector} {
${props}
}`;
}

/**
 * Generate CSS for multiple value-based triggers on a single device
 * Combines all triggers into a single CSS rule block
 *
 * @param {Array} triggers - Array of value trigger objects for this device
 * @param {Object} device - Target device object
 * @param {Object} inputLibrary - InputLibrary instance
 * @returns {string} Combined CSS rule for all value mappings
 */
export function generateValueTriggersCSS(triggers, device, inputLibrary) {
	if (!triggers || !device || !inputLibrary) return '';

	const deviceType = DEVICE_TYPES[device.type];
	if (!deviceType) return '';

	// Collect all CSS property/value pairs
	const properties = [];

	for (const trigger of triggers) {
		if (trigger.triggerType !== 'value') continue;

		const propValue = _generateValueTriggerProperty(trigger, device, deviceType, inputLibrary);
		if (propValue) {
			properties.push(propValue);
		}
	}

	if (properties.length === 0) return '';

	// Build combined CSS rule
	const selector = `#${device.cssIdentifier}`;
	const props = properties.map(p => `  ${p.property}: ${p.value};`).join('\n');

	return `${selector} {\n${props}\n}`;
}

/**
 * Generate CSS property/value for a single value trigger
 * @private
 */
function _generateValueTriggerProperty(trigger, device, deviceType, inputLibrary) {
	// Get input and its exported values
	const input = inputLibrary.get(trigger.inputId);
	if (!input) return null;

	const exportedValues = getInputExportedValues(input);
	const inputValue = exportedValues.find(v => v.key === trigger.inputValueKey);
	if (!inputValue || !inputValue.cssProperty) return null;

	const controlDef = deviceType.controls.find(c => c.id === trigger.controlId);
	if (!controlDef) return null;

	// Get control metadata and find the specific value by id
	const metadata = controlDef.type.getValueMetadata();
	if (!metadata || !metadata.values) return null;

	// For single-value controls, controlValueId may be null - use first value
	// For multi-value controls, find by id
	const controlMeta = trigger.controlValueId
		? metadata.values.find(v => v.id === trigger.controlValueId)
		: metadata.values[0];
	if (!controlMeta) return null;

	// Build the CSS property and value
	const inputCssProperty = inputValue.cssProperty;
	const outputCssProperty = controlMeta.cssProperty;

	if (!outputCssProperty) {
		// Control doesn't have a direct CSS property (e.g., individual RGB channels)
		// Skip for now - could be extended to support rgb() building
		return null;
	}

	// Determine input and output ranges (use overrides if provided)
	// inputValue now contains inline metadata (min, max, unit)
	const inputMin = trigger.inputMin ?? inputValue.min;
	const inputMax = trigger.inputMax ?? inputValue.max;
	const outputMin = trigger.outputMin ?? controlMeta.min;
	const outputMax = trigger.outputMax ?? controlMeta.max;
	const inputUnit = inputValue.unit || '';
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

	return { property: outputCssProperty, value: cssValue };
}

/**
 * Generate a CSS calc() expression for value conversion
 * Uses the general linear transformation: output = (input - inputMin) / inputRange * outputRange + outputMin
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
	const scale = outputRange / inputRange;

	// Special case: direct mapping when ranges and units match
	if (inputMin === outputMin && inputMax === outputMax && inputUnit === outputUnit) {
		return `var(${inputProperty})`;
	}

	// Same unit - straightforward linear transformation
	if (inputUnit === outputUnit) {
		if (inputMin === 0 && outputMin === 0) {
			return scale === 1 ? `var(${inputProperty})` : `calc(var(${inputProperty}) * ${scale})`;
		}
		const offset = outputMin - (inputMin * scale);
		if (offset === 0) {
			return `calc(var(${inputProperty}) * ${scale})`;
		}
		if (scale === 1) {
			return `calc(var(${inputProperty}) + ${offset}${outputUnit})`;
		}
		return `calc(var(${inputProperty}) * ${scale} + ${offset}${outputUnit})`;
	}

	// Cross-unit conversion: normalize input to 0-1, then scale to output
	// Formula: (input - inputMin) / inputRange * outputRange + outputMin
	// CSS: calc((var(--input) + offsetDeg) / rangeDeg * outputRange + outputMin)

	const inputOffsetVal = -inputMin;
	const inputOffsetStr = inputOffsetVal !== 0 ? ` + ${inputOffsetVal}${inputUnit}` : '';

	// Build the normalization part: (var(--input) + offset) / range
	// This produces a unitless 0-1 value
	const normalized = `(var(${inputProperty})${inputOffsetStr}) / ${inputRange}${inputUnit}`;

	// Scale and offset to output range
	if (outputMin === 0) {
		if (outputRange === 1 && outputUnit === '') {
			// Output is 0-1 unitless
			return `calc(${normalized})`;
		}
		return `calc(${normalized} * ${outputRange}${outputUnit})`;
	}

	return `calc(${normalized} * ${outputRange}${outputUnit} + ${outputMin}${outputUnit})`;
}
