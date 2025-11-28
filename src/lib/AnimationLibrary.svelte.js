/**
 * AnimationLibrary - Reactive Svelte 5 library for managing animations
 *
 * Extends Library base class with animation-specific functionality.
 * Stores animations as plain objects (not class instances) for proper reactivity.
 * Keyframe values are stored as control-based objects (NEW ARCHITECTURE).
 */

import { Library } from './Library.svelte.js';
import { generateCSSAnimation } from './animations/css.js';
import { toCSSIdentifier } from './css/utils.js';

export class AnimationLibrary extends Library {
	constructor() {
		super('dmx-animations');
	}

	/**
	 * Create and add a new animation
	 * @param {string} name - Animation name
	 * @param {Array<string>} controls - Control names to animate
	 * @param {string} targetLabel - Label describing the animation target (control or device type name)
	 * @returns {Object} Created animation object
	 */
	create(name, controls, targetLabel) {
		const animation = {
			name,
			controls: controls || [],
			targetLabel: targetLabel || null,
			keyframes: [],
			cssName: toCSSIdentifier(name),
			order: this.items.length
		};

		return this.add(animation);
	}

	/**
	 * Update animation properties
	 * @param {string} id - Animation ID
	 * @param {Object} updates - Properties to update (name, controls, targetLabel, etc.)
	 * @returns {boolean} Success status
	 */
	update(id, updates) {
		// Update CSS name if name changed
		if (updates.name) {
			updates.cssName = toCSSIdentifier(updates.name);
		}

		return super.update(id, updates);
	}

	/**
	 * Add a keyframe to an animation
	 * @param {string} animationId - Animation ID
	 * @param {number} time - Time (0-1)
	 * @param {Object} values - Control values object { "color": { red, green, blue }, ... }
	 */
	addKeyframe(animationId, time, values) {
		const animation = this.get(animationId);
		if (!animation) return;

		// Deep copy control values to avoid reference sharing
		const valuesCopy = {};
		for (const [key, value] of Object.entries(values)) {
			if (typeof value === 'object' && value !== null) {
				valuesCopy[key] = { ...value };
			} else {
				valuesCopy[key] = value;
			}
		}

		const keyframe = {
			time,
			values: valuesCopy
		};

		animation.keyframes.push(keyframe);
		// Sort keyframes by time
		animation.keyframes.sort((a, b) => a.time - b.time);
		this.save();
	}

	/**
	 * Remove a keyframe from an animation
	 * @param {string} animationId - Animation ID
	 * @param {number} keyframeIndex - Index of keyframe to remove
	 */
	removeKeyframe(animationId, keyframeIndex) {
		const animation = this.get(animationId);
		if (!animation) return;

		animation.keyframes.splice(keyframeIndex, 1);
		this.save();
	}

	/**
	 * Update a keyframe's time or values
	 * @param {string} animationId - Animation ID
	 * @param {number} keyframeIndex - Index of keyframe
	 * @param {Object} updates - Properties to update (time, values)
	 */
	updateKeyframe(animationId, keyframeIndex, updates) {
		const animation = this.get(animationId);
		if (!animation || !animation.keyframes[keyframeIndex]) return;

		// Deep copy values if present in updates
		const updatesCopy = { ...updates };
		if (updates.values) {
			updatesCopy.values = {};
			for (const [key, value] of Object.entries(updates.values)) {
				if (typeof value === 'object' && value !== null) {
					updatesCopy.values[key] = { ...value };
				} else {
					updatesCopy.values[key] = value;
				}
			}
		}

		Object.assign(animation.keyframes[keyframeIndex], updatesCopy);

		// Re-sort if time changed
		if (updates.time !== undefined) {
			animation.keyframes.sort((a, b) => a.time - b.time);
		}

		this.save();
	}

	/**
	 * Generate CSS for all animations
	 * @returns {string} Combined CSS for all animations
	 */
	toCSS() {
		return this.items
			.map(anim => generateCSSAnimation(anim))
			.filter(css => css)
			.join('\n\n');
	}

	/**
	 * Deserialize animation data from storage
	 * @param {Object} animData - Serialized animation data
	 * @param {number} index - Array index for order
	 */
	deserializeItem(animData, index) {
		// Process keyframes with deep copy of control values
		const keyframes = animData.keyframes?.map(kf => {
			const values = {};
			for (const [key, value] of Object.entries(kf.values || {})) {
				if (typeof value === 'object' && value !== null) {
					values[key] = { ...value };
				} else {
					values[key] = value;
				}
			}

			return {
				time: kf.time,
				values
			};
		}) || [];

		return {
			id: animData.id || crypto.randomUUID(),
			name: animData.name,
			controls: animData.controls || [],
			targetLabel: animData.targetLabel || null,
			keyframes,
			cssName: animData.cssName || toCSSIdentifier(animData.name),
			order: animData.order !== undefined ? animData.order : index
		};
	}

	/**
	 * Clear all animations
	 */
	clear() {
		this.items = [];
		this.save();
	}
}
