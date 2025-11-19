/**
 * Mapping Helper Functions
 *
 * Functions that use the CSS↔DMX mappings to perform conversions.
 */

import { getDeviceColor } from '../../colorUtils.js';
import { CSS_TO_DMX_MAPPING } from './cssToDmxMapping.js';
import { CONTROL_CSS_MAPPING } from './dmxToCssMapping.js';

/**
 * Generate CSS properties from DMX values for a set of controls
 *
 * @param {Array} controls - Array of control definitions
 * @param {Array} components - Array of component definitions
 * @param {Array} values - DMX values (0-255)
 * @param {string} deviceType - Device type (for color generation)
 * @returns {Object} CSS properties object
 */
export function generateCSSProperties(controls, components, values, deviceType) {
	const properties = {};

	for (const control of controls) {
		const mapping = CONTROL_CSS_MAPPING[control.type];
		if (!mapping) continue;

		if (control.type === 'xypad') {
			// XY Pad control (e.g., Pan/Tilt)
			const xChannel = components[control.components.x].channel;
			const yChannel = components[control.components.y].channel;
			const xValue = values[xChannel] || 0;
			const yValue = values[yChannel] || 0;

			properties[mapping.properties.x.name] = mapping.properties.x.convert(xValue);
			properties[mapping.properties.y.name] = mapping.properties.y.convert(yValue);

		} else if (control.type === 'rgb') {
			// RGB Color control - uses getDeviceColor
			properties.color = getDeviceColor(deviceType, values);

		} else if (control.type === 'slider') {
			// Slider control (Dimmer, Intensity, White, Amber, etc.)
			const channel = components[control.components.value].channel;
			const value = values[channel] || 0;

			const propName = mapping.properties.value.getName(control.name);
			const propValue = mapping.properties.value.convert(value, control.name);
			properties[propName] = propValue;

		} else if (control.type === 'toggle') {
			// Toggle control (Safety, etc.)
			const channel = components[control.components.value].channel;
			const value = values[channel] || 0;

			const propName = mapping.properties.value.getName(control.name);
			const propValue = mapping.properties.value.convert(value, control.name, control);
			properties[propName] = propValue;
		}
	}

	return properties;
}

/**
 * Sample CSS properties based on device controls and convert to DMX component values
 * This is the inverse of generateCSSProperties - it reads CSS and produces DMX values
 *
 * @param {CSSStyleDeclaration} computed - Computed style from getComputedStyle()
 * @param {Array} controls - Array of control definitions from device type
 * @param {Array} components - Array of component definitions (with name and channel)
 * @returns {Object} Map of component names to DMX values (e.g., {Red: 255, Green: 128, Blue: 0})
 */
export function sampleCSSPropertiesFromControls(computed, controls, components) {
	const result = {};

	// Process each control
	for (const control of controls) {
		const mapping = CONTROL_CSS_MAPPING[control.type];
		if (!mapping) continue;

		if (control.type === 'xypad') {
			// XY Pad control (e.g., Pan/Tilt)
			const xComponent = components[control.components.x];
			const yComponent = components[control.components.y];

			// Sample X property (pan)
			const xValue = computed.getPropertyValue(mapping.properties.x.name);
			if (xValue) {
				const xMapping = CSS_TO_DMX_MAPPING[mapping.properties.x.name];
				if (xMapping) {
					const sampledX = xMapping.sample(xValue);
					Object.assign(result, sampledX);
				}
			}

			// Sample Y property (tilt)
			const yValue = computed.getPropertyValue(mapping.properties.y.name);
			if (yValue) {
				const yMapping = CSS_TO_DMX_MAPPING[mapping.properties.y.name];
				if (yMapping) {
					const sampledY = yMapping.sample(yValue);
					Object.assign(result, sampledY);
				}
			}

		} else if (control.type === 'rgb') {
			// RGB Color control - sample the color property
			const colorValue = computed.color;
			if (colorValue) {
				const colorMapping = CSS_TO_DMX_MAPPING['color'];
				const sampledColor = colorMapping.sample(colorValue);
				Object.assign(result, sampledColor);
			}

		} else if (control.type === 'slider') {
			// Slider control (Dimmer, Intensity, White, Amber, etc.)
			const component = components[control.components.value];
			const propName = mapping.properties.value.getName(control.name);

			let cssValue = computed.getPropertyValue(propName);

			// For intensity/dimmer, also check opacity as fallback
			if (!cssValue && (control.name === 'Dimmer' || control.name === 'Intensity')) {
				cssValue = computed.opacity;
				if (cssValue) {
					const opacityMapping = CSS_TO_DMX_MAPPING['opacity'];
					const sampledOpacity = opacityMapping.sample(cssValue);
					result[component.name] = sampledOpacity.Intensity || sampledOpacity.Dimmer;
				}
			} else if (cssValue) {
				const cssMapping = CSS_TO_DMX_MAPPING[propName];
				if (cssMapping) {
					const sampledValue = cssMapping.sample(cssValue);
					// Map to the actual component name
					Object.assign(result, sampledValue);
				}
			}

		} else if (control.type === 'toggle') {
			// Toggle control (Safety, etc.)
			const component = components[control.components.value];
			const propName = mapping.properties.value.getName(control.name);
			const cssValue = computed.getPropertyValue(propName);

			if (cssValue) {
				const cssMapping = CSS_TO_DMX_MAPPING[propName];
				if (cssMapping) {
					const sampledValue = cssMapping.sample(cssValue);
					Object.assign(result, sampledValue);
				}
			}
		}
	}

	return result;
}

/**
 * Sample CSS properties and convert to DMX component values
 * Only samples properties that the device supports
 *
 * @param {CSSStyleDeclaration} computed - Computed style from getComputedStyle()
 * @param {Array} components - Array of component definitions (with name and channel)
 * @returns {Object} Map of component names to DMX values
 */
export function sampleCSSProperties(computed, components) {
	const result = {};

	// Build set of available component names for quick lookup
	const availableComponents = new Set(components.map(c => c.name));

	// Helper to check if device has component(s)
	const hasComponent = (componentName) => availableComponents.has(componentName);
	const hasAllComponents = (componentNames) => componentNames.every(hasComponent);

	// Sample each CSS property
	for (const [propertyName, mapping] of Object.entries(CSS_TO_DMX_MAPPING)) {
		// Skip if device doesn't have required components
		if (mapping.requiredComponents.length > 0 && !hasAllComponents(mapping.requiredComponents)) {
			continue;
		}

		// Get the CSS value
		let cssValue;
		if (propertyName.startsWith('--')) {
			// Custom property
			cssValue = computed.getPropertyValue(propertyName);
			if (!cssValue) continue; // Property not set
		} else {
			// Standard property
			cssValue = computed[propertyName];
		}

		// Sample and convert to DMX values
		const sampledValues = mapping.sample(cssValue);

		// Only include components that this device actually has
		for (const [componentName, dmxValue] of Object.entries(sampledValues)) {
			if (hasComponent(componentName)) {
				result[componentName] = dmxValue;
			}
		}
	}

	// Sample dynamic pressure properties (e.g., --button-a-pressure, --key-space-pressure)
	// These are created dynamically by input controller based on input names
	const allProperties = Array.from(computed);
	for (const propertyName of allProperties) {
		if (propertyName.endsWith('-pressure')) {
			const cssValue = computed.getPropertyValue(propertyName);
			if (cssValue) {
				// Use the pressure mapping to convert to DMX
				const pressureMapping = CSS_TO_DMX_MAPPING['--pressure'];
				const sampledValues = pressureMapping.sample(cssValue);

				// Only include components that this device actually has
				for (const [componentName, dmxValue] of Object.entries(sampledValues)) {
					if (hasComponent(componentName)) {
						result[componentName] = dmxValue;
					}
				}
			}
		}
	}

	return result;
}
