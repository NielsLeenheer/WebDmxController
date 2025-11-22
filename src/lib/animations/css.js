/**
 * CSS Generation for Animations
 *
 * Functions for converting animations to CSS @keyframes rules
 */

import { getDeviceColor } from '../outputs/devices.js';
import { getProperties } from '../outputs/css.js';
import { getControlsForRendering } from './utils.js';

/**
 * Convert animation to CSS @keyframes rule
 * @param {Object} animation - Plain animation object
 * @returns {string} CSS @keyframes rule
 */
export function generateCSSAnimation(animation) {
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
 *
 * NEW: Works with control-based values
 *
 * @param {Object} animation - Plain animation object
 * @param {Object} keyframe - Keyframe object
 * @returns {Object} CSS properties object
 */
function getKeyframeProperties(animation, keyframe) {
	const controls = getControlsForRendering(animation);

	// Use shared mapping function - NEW signature: (controlValues, controls)
	return getProperties(keyframe.values, controls);
}
