/**
 * Animation System
 *
 * Animations store control values that can be mapped to CSS
 * for preview and applied to devices for playback.
 * NEW ARCHITECTURE: Works with control-based values
 */

import { DEVICE_TYPES } from '../outputs/devices.js';

/**
 * Get controls array for rendering
 *
 * NEW: Simplified to return just controls array (no components needed)
 *
 * @param {Object} animation - Plain animation object
 * @returns {Array} Array of control definitions
 */
export function getControlsForRendering(animation) {
	if (!animation.controls || animation.controls.length === 0) {
		// Fallback: use RGB device controls
		return DEVICE_TYPES.RGB.controls;
	}

	// Find a device type that has all the required controls
	for (const deviceDef of Object.values(DEVICE_TYPES)) {
		const hasAllControls = animation.controls.every(controlName =>
			deviceDef.controls.some(c => c.name === controlName)
		);
		if (hasAllControls) {
			// Filter to only the controls we want
			const filteredControls = deviceDef.controls.filter(c =>
				animation.controls.includes(c.name)
			);
			return filteredControls;
		}
	}

	// Fallback to RGB if no device type matches
	return DEVICE_TYPES.RGB.controls;
}

/**
 * Get color for a keyframe (for visualization)
 *
 * NEW: Works with control values
 *
 * @param {Object} keyframe - Keyframe object with control values
 * @returns {string} RGB color string
 */
export function getKeyframeColor(keyframe) {
	// Extract color from control values
	const colorValue = keyframe.values?.Color;
	if (colorValue && typeof colorValue === 'object') {
		const r = colorValue.r ?? 0;
		const g = colorValue.g ?? 0;
		const b = colorValue.b ?? 0;
		return `rgb(${r}, ${g}, ${b})`;
	}
	return 'transparent';
}

/**
 * Get interpolated control values at a specific time
 *
 * NEW: Works with control values and returns control values object
 *
 * @param {Object} animation - Plain animation object
 * @param {number} time - Time (0-1)
 * @returns {Object} Interpolated control values
 */
export function getValuesAtTime(animation, time) {
	if (!animation.keyframes || animation.keyframes.length === 0) {
		// No keyframes - return empty object
		return {};
	}

	const sortedKeyframes = [...animation.keyframes].sort((a, b) => a.time - b.time);

	// Before first keyframe - use first keyframe values
	if (time <= sortedKeyframes[0].time) {
		return { ...sortedKeyframes[0].values };
	}

	// After last keyframe - use last keyframe values
	if (time >= sortedKeyframes[sortedKeyframes.length - 1].time) {
		return { ...sortedKeyframes[sortedKeyframes.length - 1].values };
	}

	// Find surrounding keyframes
	for (let i = 0; i < sortedKeyframes.length - 1; i++) {
		const kf1 = sortedKeyframes[i];
		const kf2 = sortedKeyframes[i + 1];

		if (time >= kf1.time && time <= kf2.time) {
			// Interpolate between kf1 and kf2
			const t = (time - kf1.time) / (kf2.time - kf1.time);
			const interpolatedValues = {};

			// Get all control names from both keyframes
			const controlNames = new Set([
				...Object.keys(kf1.values),
				...Object.keys(kf2.values)
			]);

			for (const controlName of controlNames) {
				const v1 = kf1.values[controlName];
				const v2 = kf2.values[controlName];

				if (v1 === undefined) {
					interpolatedValues[controlName] = v2;
				} else if (v2 === undefined) {
					interpolatedValues[controlName] = v1;
				} else if (typeof v1 === 'object' && typeof v2 === 'object') {
					// Interpolate object values (e.g., RGB, Pan/Tilt)
					interpolatedValues[controlName] = {};
					const keys = new Set([...Object.keys(v1), ...Object.keys(v2)]);
					for (const key of keys) {
						const val1 = v1[key] ?? 0;
						const val2 = v2[key] ?? 0;
						interpolatedValues[controlName][key] = Math.round(val1 + (val2 - val1) * t);
					}
				} else {
					// Interpolate scalar values (e.g., Dimmer)
					interpolatedValues[controlName] = Math.round(v1 + (v2 - v1) * t);
				}
			}

			return interpolatedValues;
		}
	}

	// Fallback - shouldn't reach here
	return { ...sortedKeyframes[0].values };
}

/**
 * Get number of controls for animation
 *
 * NEW: Returns number of controls instead of channels
 *
 * @param {Object} animation - Plain animation object
 * @returns {number} Number of controls
 */
export function getNumControls(animation) {
	if (!animation.controls || animation.controls.length === 0) {
		// Fallback to RGB (1 control: Color)
		return 1;
	}

	return animation.controls.length;
}

/**
 * Get number of channels for animation
 * DEPRECATED: Use getNumControls() instead
 */
export function getNumChannels(animation) {
	console.warn('getNumChannels() is deprecated. Use getNumControls() instead.');
	return getNumControls(animation);
}
