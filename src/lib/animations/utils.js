/**
 * Animation System
 *
 * Animations store device values (channel data) that can be mapped to CSS
 * for preview and applied to devices for playback.
 */

import { getDeviceColor, DEVICE_TYPES } from '../outputs/devices.js';
import { generateCSSProperties } from '../outputs/css.js';

/**
 * Get controls and components arrays for rendering
 * @param {Object} animation - Plain animation object
 * @returns {Object} Object with controls and components arrays
 */
export function getControlsForRendering(animation) {
	if (!animation.controls || animation.controls.length === 0) {
		// Fallback: use RGB device controls
		return {
			controls: DEVICE_TYPES.RGB.controls,
			components: DEVICE_TYPES.RGB.components
		};
	}

	// Find a device type that has all the required controls
	for (const [deviceKey, deviceDef] of Object.entries(DEVICE_TYPES)) {
		const hasAllControls = animation.controls.every(controlName =>
			deviceDef.controls.some(c => c.name === controlName)
		);
		if (hasAllControls) {
			// Filter to only the controls we want
			const filteredControls = deviceDef.controls.filter(c =>
				animation.controls.includes(c.name)
			);
			return {
				controls: filteredControls,
				components: deviceDef.components
			};
		}
	}

	// Fallback to RGB if no device type matches
	return {
		controls: DEVICE_TYPES.RGB.controls,
		components: DEVICE_TYPES.RGB.components
	};
}

/**
 * Get color for a keyframe (for visualization)
 * @param {Object} keyframe - Keyframe object
 * @returns {string} RGB color string
 */
export function getKeyframeColor(keyframe) {
	return getDeviceColor(keyframe.deviceType, keyframe.values);
}

/**
 * Get interpolated values at a specific time
 * @param {Object} animation - Plain animation object
 * @param {number} time - Time (0-1)
 * @returns {Array<number>} Interpolated channel values
 */
export function getValuesAtTime(animation, time) {
	if (!animation.keyframes || animation.keyframes.length === 0) {
		// No keyframes - return zeros (default to RGB)
		return [0, 0, 0];
	}

	const sortedKeyframes = [...animation.keyframes].sort((a, b) => a.time - b.time);

	// Before first keyframe - use first keyframe values
	if (time <= sortedKeyframes[0].time) {
		return [...sortedKeyframes[0].values];
	}

	// After last keyframe - use last keyframe values
	if (time >= sortedKeyframes[sortedKeyframes.length - 1].time) {
		return [...sortedKeyframes[sortedKeyframes.length - 1].values];
	}

	// Find surrounding keyframes
	for (let i = 0; i < sortedKeyframes.length - 1; i++) {
		const kf1 = sortedKeyframes[i];
		const kf2 = sortedKeyframes[i + 1];

		if (time >= kf1.time && time <= kf2.time) {
			// Interpolate between kf1 and kf2
			const t = (time - kf1.time) / (kf2.time - kf1.time);
			const values = [];
			for (let j = 0; j < kf1.values.length; j++) {
				const v1 = kf1.values[j];
				const v2 = kf2.values[j];
				values.push(Math.round(v1 + (v2 - v1) * t));
			}
			return values;
		}
	}

	// Fallback - shouldn't reach here
	return [...sortedKeyframes[0].values];
}

/**
 * Get number of channels for animation
 * @param {Object} animation - Plain animation object
 * @returns {number} Number of channels
 */
export function getNumChannels(animation) {
	const { controls, components } = getControlsForRendering(animation);

	if (!animation.controls || animation.controls.length === 0) {
		// Animate all channels
		return components.length;
	}

	// Count unique channels for the specified controls
	const channels = new Set();
	for (const control of controls) {
		for (const componentIndex of Object.values(control.components)) {
			const channel = components[componentIndex].channel;
			channels.add(channel);
		}
	}

	return channels.size;
}

/**
 * Convert animation to CSS @keyframes rule
 * @param {Object} animation - Plain animation object
 * @returns {string} CSS @keyframes rule
 */
export function animationToCSS(animation) {
	if (!animation.keyframes || animation.keyframes.length === 0) {
		return '';
	}

	// Generate CSS based on controls being animated
	const keyframeRules = animation.keyframes.map(kf => {
		const percent = Math.round(kf.time * 100);
		const properties = getKeyframeProperties(animation, kf);
		const props = Object.entries(properties)
			.map(([prop, value]) => `${prop}: ${value}`)
			.join('; ');
		return `${percent}% { ${props}; }`;
	}).join('\n  ');

	return `@keyframes ${animation.cssName} {\n  ${keyframeRules}\n}`;
}

/**
 * Get CSS properties for a keyframe
 * @param {Object} animation - Plain animation object
 * @param {Object} keyframe - Keyframe object
 * @returns {Object} CSS properties object
 */
function getKeyframeProperties(animation, keyframe) {
	const { controls, components } = getControlsForRendering(animation);

	// Use shared mapping function
	const properties = generateCSSProperties(controls, components, keyframe.values, keyframe.deviceType);

	// Fallback: if no properties generated, use color
	if (Object.keys(properties).length === 0) {
		properties.color = getDeviceColor(keyframe.deviceType, keyframe.values);
	}

	return properties;
}
