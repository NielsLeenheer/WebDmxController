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
			name,
			controls: controls || [],
			displayName: displayName || null,
			keyframes: [],
			cssName: toCSSIdentifier(name),
			order: this.items.length
		};

		return this.add(animation);
	}

	/**
	 * Update animation properties
	 * @param {string} id - Animation ID
	 * @param {Object} updates - Properties to update (name, controls, displayName, etc.)
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
	 * @param {string} deviceType - Device type for rendering
	 * @param {Array<number>} values - Channel values
	 */
	addKeyframe(animationId, time, deviceType, values) {
		const animation = this.get(animationId);
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
			id: animData.id || crypto.randomUUID(), // Generate UUID if not present
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
	 * Clear all animations
	 */
	clear() {
		this.items = [];
		this.save();
	}
}
