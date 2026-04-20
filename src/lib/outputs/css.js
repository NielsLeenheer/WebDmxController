/**
 * CSS Generation for Device Outputs
 *
 * Functions for converting control values to CSS properties
 * Uses control metadata (getValueMetadata) for property names and value conversion
 */

import { DEVICE_TYPES } from './devices.js';

/**
 * Convert a DMX value to CSS value using control metadata
 * @param {number} dmxValue - DMX value (0-255 or 0-65535)
 * @param {Object} meta - Value metadata from getValueMetadata()
 * @returns {string} CSS value with unit
 */
function dmxToCssValue(dmxValue, meta) {
	const dmxRange = meta.dmxMax - meta.dmxMin;
	const cssRange = meta.max - meta.min;
	const normalized = (dmxValue - meta.dmxMin) / dmxRange;
	const cssValue = normalized * cssRange + meta.min;

	// Format based on unit
	if (meta.unit === '%') {
		return `${cssValue.toFixed(1)}%`;
	} else if (meta.unit === '') {
		// Unitless - check if it should be integer or decimal
		if (Number.isInteger(meta.min) && Number.isInteger(meta.max) && meta.max > 1) {
			return Math.round(cssValue).toString();
		}
		return cssValue.toFixed(3);
	}
	return cssValue.toString();
}

/**
 * Get CSS properties from control values
 *
 * @param {Object} controlValues - Control values object { "color": { red, green, blue }, "dimmer": 255, ... }
 * @param {Array} controls - Array of control definitions from device type
 * @param {Object} options - Optional settings
 * @param {boolean} options.includeColorProperty - Include combined color property (only for device defaults)
 * @returns {Object} CSS properties object
 */
export function getProperties(controlValues, controls, options = {}) {
	const properties = {};
	const { includeColorProperty = false } = options;

	for (const control of controls) {
		if (control.separator) continue;

		const controlValue = controlValues[control.id];
		if (controlValue === undefined) continue;

		const meta = control.type.getValueMetadata?.();
		if (!meta) continue;

		if (control.type.type === 'xypad' || control.type.type === 'xypad16') {
			// XY Pad control (e.g., Pan/Tilt) - has multiple values
			const panValue = controlValue.pan ?? 128;
			const tiltValue = controlValue.tilt ?? 128;

			if (meta.values) {
				const panMeta = meta.values[0];
				const tiltMeta = meta.values[1];
				properties[panMeta.cssProperty] = dmxToCssValue(panValue, panMeta);
				properties[tiltMeta.cssProperty] = dmxToCssValue(tiltValue, tiltMeta);
			}

		} else if (control.type.type === 'rgb') {
			// RGB Color control - has multiple values
			const r = controlValue.red ?? 0;
			const g = controlValue.green ?? 0;
			const b = controlValue.blue ?? 0;

			if (meta.values) {
				const rMeta = meta.values[0];
				const gMeta = meta.values[1];
				const bMeta = meta.values[2];
				const colorMeta = meta.values[3];
				properties[rMeta.cssProperty] = dmxToCssValue(r, rMeta);
				properties[gMeta.cssProperty] = dmxToCssValue(g, gMeta);
				properties[bMeta.cssProperty] = dmxToCssValue(b, bMeta);

				// Only include combined color property for device defaults
				if (includeColorProperty && colorMeta) {
					properties[colorMeta.cssProperty] = colorMeta.value;
				}
			}

		} else if (control.type.type === 'toggle') {
			// Toggle control
			const value = controlValue ?? control.type.offValue;
			const toggleMeta = meta.values?.[0] || meta;
			const isOn = value >= toggleMeta.dmxOn;
			properties[toggleMeta.cssProperty] = isOn ? toggleMeta.on : toggleMeta.off;

		} else if (control.type.type === 'slider') {
			// Slider control (Dimmer, Intensity, White, Amber, etc.)
			const value = controlValue ?? 0;
			const sliderMeta = meta.values?.[0] || meta;
			properties[sliderMeta.cssProperty] = dmxToCssValue(value, sliderMeta);

		} else if (control.type.type === 'sparks') {
			// Sparks control — emit --sparks (slider level) and --sparks-cleaning.
			const level = controlValue?.level ?? 0;
			const cleaning = !!controlValue?.cleaning;
			const levelMeta = meta.values?.find(v => v.id === 'level');
			const cleaningMeta = meta.values?.find(v => v.id === 'cleaning');
			if (levelMeta) {
				properties[levelMeta.cssProperty] = level.toString();
			}
			if (cleaningMeta) {
				properties[cleaningMeta.cssProperty] = cleaning ? cleaningMeta.on : cleaningMeta.off;
			}

		} else if (control.type.type === 'wheel') {
			// Wheel control (Color wheel / Pattern disk):
			//   - Color wheels emit --red/--green/--blue (from the first color of
			//     the selected swatch — always the "primary" color even in dual mode)
			//     plus a composite `color` property.
			//   - Pattern wheels emit a --pattern string (the slot's id).
			//   - Both emit --<prefix>-mode ("normal" | "dual"/"shake") and
			//     --<prefix>-speed (-100..100).
			const modifier = !!controlValue.modifier;
			const index = controlValue.index ?? 0;
			const speed = controlValue.speed ?? 0;

			const activeSlots = modifier
				? (control.type.modifierSlots ?? control.type.staticSlots)
				: control.type.staticSlots;
			const clampedIndex = Math.max(0, Math.min(activeSlots.length - 1, index));
			const slot = activeSlots[clampedIndex];

			const rMeta = meta.values?.find(v => v.id === 'red');
			const gMeta = meta.values?.find(v => v.id === 'green');
			const bMeta = meta.values?.find(v => v.id === 'blue');
			const colorMeta = meta.values?.find(v => v.id === 'color');
			const patternMeta = meta.values?.find(v => v.id === 'pattern');
			const modeMeta = meta.values?.find(v => v.id === 'mode');
			const speedMeta = meta.values?.find(v => v.id === 'speed');

			// Color wheel: --red/--green/--blue from the slot's FIRST color
			const hex = slot?.colors?.[0];
			if (hex && rMeta && gMeta && bMeta) {
				const h = hex.replace('#', '');
				properties[rMeta.cssProperty] = parseInt(h.substring(0, 2), 16).toString();
				properties[gMeta.cssProperty] = parseInt(h.substring(2, 4), 16).toString();
				properties[bMeta.cssProperty] = parseInt(h.substring(4, 6), 16).toString();

				if (includeColorProperty && colorMeta) {
					properties[colorMeta.cssProperty] = colorMeta.value;
				}
			}

			// Pattern wheel: --pattern is the slot's id
			if (patternMeta && slot?.id) {
				properties[patternMeta.cssProperty] = slot.id;
			}

			// Mode (only meaningful when modifier slots exist on the control)
			if (modeMeta && control.type.modifierSlots) {
				const modeKeyword = rMeta ? 'dual' : 'shake';
				properties[modeMeta.cssProperty] = modifier ? modeKeyword : 'normal';
			}

			// Speed
			if (speedMeta) {
				properties[speedMeta.cssProperty] = speed.toString();
			}
		}
	}

	return properties;
}

/**
 * Generate CSS block for a single device's default values
 *
 * Works with control-based values. For linked devices, only generates CSS
 * for controls that are NOT synced from the source device.
 *
 * @param {Object} device - Device object with type, defaultValues (control values), cssIdentifier, linkedTo, syncedControls
 * @returns {string|null} CSS block string or null if no CSS should be generated
 */
export function generateCSSBlock(device) {
	const deviceType = DEVICE_TYPES[device.type];
	if (!deviceType) return null;

	// Get control values from device
	const controlValues = device.defaultValues || {};

	// Filter controls to exclude synced controls for linked devices
	let controls = deviceType.controls;
	if (device.linkedTo !== null) {
		// Get the set of synced control IDs
		const syncedControlIds = new Set(device.syncedControls || []);
		
		// If no specific controls are synced but device is linked, assume all common controls are synced
		// In this case, we need to determine which controls are shared with the source device
		if (syncedControlIds.size === 0 && device.syncedControls === null) {
			// All controls are potentially synced, skip CSS generation entirely
			return null;
		}
		
		// Filter out synced controls
		controls = deviceType.controls.filter(control => !syncedControlIds.has(control.id));
		
		// If all controls are synced, skip CSS generation
		if (controls.length === 0) return null;
	}

	// Generate CSS properties from control values (include color property for device defaults)
	const properties = getProperties(controlValues, controls, { includeColorProperty: true });

	if (Object.keys(properties).length === 0) return null;

	// Convert properties object to CSS string
	const props = Object.entries(properties)
		.map(([prop, value]) => `  ${prop}: ${value};`)
		.join('\n');

	return `#${device.cssIdentifier} {\n${props}\n}`;
}
