/**
 * Trigger Manager
 *
 * Manages CSS classes for input triggers and scene changes
 */

import { EventEmitter } from '../EventEmitter.js';

/**
 * Manages active CSS classes for trigger mappings
 * Emits 'sceneChange' events when scene triggers are activated
 */
export class TriggerManager extends EventEmitter {
	constructor() {
		super();
		this.activeClasses = new Set();
		this.upClasses = new Set(); // Track up/off state triggers
		this.container = null; // Will be set to the container element
	}

	/**
	 * Set the container element
	 */
	setContainer(element) {
		this.container = element;

		// Apply all up/off classes to the container
		for (const className of this.upClasses) {
			element.classList.add(className);
		}
	}

	/**
	 * Register a trigger mapping
	 */
	register(mapping) {
		if (mapping.mode !== 'trigger') return;

		// For up/off types, add to permanent sets
		const state = mapping.input?.state;
		if (state === 'up' || state === 'off') {
			this.upClasses.add(mapping.cssClassName);
			if (this.container) {
				this.container.classList.add(mapping.cssClassName);
			}
		}
	}

	/**
	 * Unregister a trigger mapping
	 */
	unregister(mapping) {
		if (mapping.mode !== 'trigger') return;

		this.upClasses.delete(mapping.cssClassName);

		if (this.container) {
			this.container.classList.remove(mapping.cssClassName);
		}
	}

	/**
	 * Trigger a mapping when input is pressed
	 */
	trigger(mapping) {
		if (mapping.mode !== 'trigger') return;
		if (!this.container) return;

		// Handle scene change actions
		if (mapping.action?.type === 'scene' && mapping.action?.scene?.id) {
			// Only trigger scene change on 'down' state
			const state = mapping.input?.state;
			if (state === 'down' || state === 'on') {
				this._emit('sceneChange', { sceneId: mapping.action.scene.id });
			}
			return;
		}

		// Both animation and setValue actions use CSS classes
		const className = mapping.cssClassName;
		const state = mapping.input?.state;

		if (state === 'down' || state === 'on') {
			// Down/On: Add class when triggered
			this.container.classList.add(className);
			this.activeClasses.add(className);
		} else if (state === 'up' || state === 'off') {
			// Up/Off: Remove class when triggered (pressed)
			this.container.classList.remove(className);
		}
	}

	/**
	 * Release a mapping when input is released
	 */
	release(mapping) {
		if (mapping.mode !== 'trigger') return;
		if (!this.container) return;

		// Both animation and setValue actions use CSS classes
		const className = mapping.cssClassName;
		const state = mapping.input?.state;

		if (state === 'down' || state === 'on') {
			// Down/On: Remove class when released
			this.container.classList.remove(className);
			this.activeClasses.delete(className);
		} else if (state === 'up' || state === 'off') {
			// Up/Off: Add class back when released
			this.container.classList.add(className);
		}
	}

	/**
	 * Add raw CSS class (for inputs without mappings)
	 */
	addRawClass(className) {
		if (!this.container) return;
		this.container.classList.add(className);
	}

	/**
	 * Remove raw CSS class (for inputs without mappings)
	 */
	removeRawClass(className) {
		if (!this.container) return;
		this.container.classList.remove(className);
	}

	/**
	 * Clear all active classes
	 */
	clearAll() {
		if (!this.container) return;

		for (const className of this.activeClasses) {
			this.container.classList.remove(className);
		}

		this.activeClasses.clear();
	}
}
