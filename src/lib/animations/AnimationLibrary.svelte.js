/**
 * AnimationLibrary - Reactive Svelte 5 library for managing animations
 *
 * Extends Library base class with animation-specific functionality.
 * Animations use 'name' as their unique identifier (not 'id').
 */

import { Library } from '../Library.svelte.js';
import { Animation } from '../animations.js';

export class AnimationLibrary extends Library {
	constructor() {
		super('dmx-animations');
	}

	/**
	 * Add an animation to the library
	 * @param {Animation} animation - Animation object to add
	 */
	add(animation) {
		// Animations use 'name' as identifier, but Library expects 'id'
		// Set id = name for compatibility with base Library
		animation.id = animation.name;

		// Set order if not present
		if (animation.order === undefined) {
			animation.order = this.items.length;
		}

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
	 * Rename an animation
	 * @param {string} oldName - Current animation name
	 * @param {string} newName - New animation name
	 * @returns {boolean} Success status
	 */
	rename(oldName, newName) {
		const animation = this.get(oldName);
		if (!animation) return false;

		animation.name = newName;
		animation.id = newName; // Keep id in sync
		animation.updateCSSName(); // Update CSS name based on new name
		this.save();
		return true;
	}

	/**
	 * Generate CSS for all animations
	 * @returns {string} Combined CSS for all animations
	 */
	toCSS() {
		return this.items
			.map(anim => anim.toCSS())
			.filter(css => css)
			.join('\n\n');
	}

	/**
	 * Deserialize animation data from storage
	 * @param {Object} animData - Serialized animation data
	 * @param {number} index - Array index for order
	 */
	deserializeItem(animData, index) {
		const animation = Animation.fromJSON(animData);
		animation.id = animation.name; // Set id = name for Library compatibility
		animation.order = animData.order !== undefined ? animData.order : index;
		return animation;
	}

	/**
	 * Reorder animations based on array of names (not IDs)
	 * @param {Array<string>} orderedNames - Array of animation names in new order
	 */
	reorder(orderedNames) {
		// Override to use names instead of IDs
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
