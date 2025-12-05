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
	
	// Get all action triggers for this device (value triggers handled separately)
	const deviceTriggers = allTriggers.filter(t => t.output?.id === device.id && t.type === 'action');
	
	// Generate CSS for each trigger
	for (const trigger of deviceTriggers) {
		const css = _generateTriggerCSS(device, trigger, animationLibrary, inputLibrary);
		if (css) cssRules.push(css);
	}
	
	return cssRules.join('\n\n');
}

/**
 * Generate CSS for a trigger on a device
 * @private
 */
function _generateTriggerCSS(device, trigger, animationLibrary, inputLibrary) {
	if (trigger.action?.type === 'animation') {
		return _generateAnimationCSS(device, trigger, animationLibrary, inputLibrary);
	} else if (trigger.action?.type === 'values') {
		return _generateValuesCSS(device, trigger, inputLibrary);
	}
	return '';
}

/**
 * Generate CSS for animation trigger
 * @private
 */
function _generateAnimationCSS(device, trigger, animationLibrary, inputLibrary) {
	if (!trigger.action?.animation?.id) return '';
	
	const anim = trigger.action.animation;
	const iterationsValue = anim.iterations === 'infinite' 
		? 'infinite' 
		: anim.iterations;
	const durationSec = (anim.duration / 1000).toFixed(3);
	
	// Look up animation to get cssIdentifier
	const animation = animationLibrary?.get(anim.id);
	const animName = animation?.cssIdentifier || anim.id;
	
	// Build the animation specification for this trigger
	const animationValue = `${animName} ${durationSec}s ${anim.easing} ${iterationsValue}`;
	
	const cssClassName = getCSSClassName(trigger, inputLibrary);
	const selector = `.${cssClassName} #${device.cssIdentifier}`;
	
	return `${selector} {
  animation: ${animationValue};
}`;
}

/**
 * Generate CSS for values trigger
 *
 * Works with control-based values
 *
 * @private
 */
function _generateValuesCSS(device, trigger, inputLibrary) {
	const values = trigger.action?.values;
	if (!values) return '';

	// Get device type
	const deviceType = DEVICE_TYPES[device.type];
	if (!deviceType) return '';

	// Filter controls to only those present in output.values (implicit enabling)
	const filteredControls = deviceType.controls.filter(control =>
		Object.hasOwn(values, control.id)
	);

	// Generate CSS properties from control values
	const properties = getProperties(values, filteredControls);

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
		if (trigger.type !== 'value') continue;

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
	const input = inputLibrary.get(trigger.input?.id);
	if (!input) return null;

	const exportedValues = getInputExportedValues(input);
	const inputValue = exportedValues.find(v => v.key === trigger.input?.value);
	if (!inputValue || !inputValue.cssProperty) return null;

	const controlDef = deviceType.controls.find(c => c.id === trigger.action?.copy?.control);
	if (!controlDef) return null;

	// Get control metadata and find the specific value by id
	const metadata = controlDef.type.getValueMetadata();
	if (!metadata || !metadata.values) return null;

	// For single-value controls, component may be null - use first value
	// For multi-value controls, find by id
	const controlMeta = trigger.action?.copy?.component
		? metadata.values.find(v => v.id === trigger.action.copy.component)
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

	// Determine input and output ranges from metadata
	const inputMin = inputValue.min;
	const inputMax = inputValue.max;
	const outputMin = controlMeta.min;
	const outputMax = controlMeta.max;
	const inputUnit = inputValue.unit || '';
	const outputUnit = controlMeta.unit || '';

	// Handle inversion
	const effectiveOutputMin = trigger.action?.copy?.invert ? outputMax : outputMin;
	const effectiveOutputMax = trigger.action?.copy?.invert ? outputMin : outputMax;

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
