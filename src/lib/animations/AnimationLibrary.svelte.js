/**
 * AnimationLibrary - Reactive Svelte 5 library for managing animations
 *
 * Extends Library base class with animation-specific functionality.
 * Stores animations as plain objects (not class instances) for proper reactivity.
 */

import { Library } from '../Library.svelte.js';
import { Animation } from '../animations.js';
import { toCSSIdentifier } from '../css/utils.js';

export class AnimationLibrary extends Library {
	constructor() {
		super('dmx-animations');
	}

	/**
	 * Create and add a new animation
	 * @param {string} name - Animation name
	 * @param {Array<string>} controls - Control names to animate
	 * @param {string} displayName - Display name for UI
	 * @returns {Object} Created animation object
	 */
	create(name, controls, displayName) {
		const animation = {
			id: name,  // Use name as ID for compatibility
			name,
			controls: controls || [],
			displayName: displayName || null,
			keyframes: [],
			cssName: toCSSIdentifier(name),
			order: this.items.length
		};

		this.items.push(animation);
		this.save();
		return animation;
	}

	/**
	 * Get animation by name
	 * @param {string} name - Animation name
	 */
	get(name) {
		return this.items.find(item => item.name === name);
	}

	/**
	 * Check if animation exists
	 * @param {string} name - Animation name
	 */
	has(name) {
		return this.items.some(item => item.name === name);
	}

	/**
	 * Remove an animation by name
	 * @param {string} name - Animation name to remove
	 */
	remove(name) {
		const index = this.items.findIndex(item => item.name === name);
		if (index !== -1) {
			this.items.splice(index, 1);
			this.save();
		}
	}

	/**
	 * Rename an animation and update its CSS name
	 * @param {string} oldName - Current animation name
	 * @param {string} newName - New animation name
	 * @returns {boolean} Success status
	 */
	rename(oldName, newName) {
		const animation = this.get(oldName);
		if (!animation) return false;

		animation.name = newName;
		animation.id = newName;
		animation.cssName = toCSSIdentifier(newName);
		this.save();
		return true;
	}

	/**
	 * Add a keyframe to an animation
	 * @param {string} animationName - Animation name
	 * @param {number} time - Time (0-1)
	 * @param {string} deviceType - Device type for rendering
	 * @param {Array<number>} values - Channel values
	 */
	addKeyframe(animationName, time, deviceType, values) {
		const animation = this.get(animationName);
		if (!animation) return;

		const keyframe = {
			time,
			deviceType,
			values: [...values]
		};

		animation.keyframes.push(keyframe);
		// Sort keyframes by time
		animation.keyframes.sort((a, b) => a.time - b.time);
		this.save();
	}

	/**
	 * Remove a keyframe from an animation
	 * @param {string} animationName - Animation name
	 * @param {number} keyframeIndex - Index of keyframe to remove
	 */
	removeKeyframe(animationName, keyframeIndex) {
		const animation = this.get(animationName);
		if (!animation) return;

		animation.keyframes.splice(keyframeIndex, 1);
		this.save();
	}

	/**
	 * Update a keyframe's time or values
	 * @param {string} animationName - Animation name
	 * @param {number} keyframeIndex - Index of keyframe
	 * @param {Object} updates - Properties to update (time, values)
	 */
	updateKeyframe(animationName, keyframeIndex, updates) {
		const animation = this.get(animationName);
		if (!animation || !animation.keyframes[keyframeIndex]) return;

		Object.assign(animation.keyframes[keyframeIndex], updates);

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
			.map(anim => Animation.toCSS(anim))
			.filter(css => css)
			.join('\n\n');
	}

	/**
	 * Deserialize animation data from storage
	 * @param {Object} animData - Serialized animation data
	 * @param {number} index - Array index for order
	 */
	deserializeItem(animData, index) {
		// Use Animation.fromJSON to handle backward compatibility
		const animation = Animation.fromJSON(animData);

		// Convert to plain object
		return {
			id: animation.name,
			name: animation.name,
			controls: animation.controls || [],
			displayName: animation.displayName || null,
			keyframes: animation.keyframes.map(kf => ({
				time: kf.time,
				deviceType: kf.deviceType,
				values: [...kf.values]
			})),
			cssName: animation.cssName || toCSSIdentifier(animation.name),
			order: animData.order !== undefined ? animData.order : index
		};
	}

	/**
	 * Reorder animations based on array of names (not IDs)
	 * @param {Array<string>} orderedNames - Array of animation names in new order
	 */
	reorder(orderedNames) {
		orderedNames.forEach((name, index) => {
			const animation = this.get(name);
			if (animation) {
				animation.order = index;
			}
		});
		this.save();
	}

	/**
	 * Clear all animations
	 */
	clear() {
		this.items = [];
		this.save();
	}
}
