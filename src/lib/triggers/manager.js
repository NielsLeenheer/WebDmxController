/**
 * Trigger Manager
 *
 * Manages CSS classes for input triggers
 */

/**
 * Manages active CSS classes for trigger mappings
 */
export class TriggerManager {
	constructor() {
		this.activeClasses = new Set();
		this.notPressedClasses = new Set(); // Track not-pressed triggers
		this.alwaysClasses = new Set(); // Track always triggers
		this.container = null; // Will be set to the container element
	}

	/**
	 * Set the container element
	 */
	setContainer(element) {
		this.container = element;

		// Apply all not-pressed and always classes to the container
		for (const className of this.notPressedClasses) {
			element.classList.add(className);
		}
		for (const className of this.alwaysClasses) {
			element.classList.add(className);
		}
	}

	/**
	 * Register a trigger mapping
	 */
	register(mapping) {
		if (mapping.mode !== 'trigger') return;

		// Both animation and setValue actions use CSS classes
		// For not-pressed and always types, add to permanent sets
		if (mapping.triggerType === 'not-pressed') {
			this.notPressedClasses.add(mapping.cssClassName);
			if (this.container) {
				this.container.classList.add(mapping.cssClassName);
			}
		} else if (mapping.triggerType === 'always') {
			this.alwaysClasses.add(mapping.cssClassName);
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

		// Both animation and setValue actions use CSS classes
		this.notPressedClasses.delete(mapping.cssClassName);
		this.alwaysClasses.delete(mapping.cssClassName);

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

		// Both animation and setValue actions use CSS classes
		const className = mapping.cssClassName;

		if (mapping.triggerType === 'pressed') {
			// Pressed: Add class when triggered
			this.container.classList.add(className);
			this.activeClasses.add(className);
		} else if (mapping.triggerType === 'not-pressed') {
			// Not-pressed: Remove class when triggered (pressed)
			this.container.classList.remove(className);
		}
		// 'always' type is always on, no action needed on trigger
	}

	/**
	 * Release a mapping when input is released
	 */
	release(mapping) {
		if (mapping.mode !== 'trigger') return;
		if (!this.container) return;

		// Both animation and setValue actions use CSS classes
		const className = mapping.cssClassName;

		if (mapping.triggerType === 'pressed') {
			// Pressed: Remove class when released
			this.container.classList.remove(className);
			this.activeClasses.delete(className);
		} else if (mapping.triggerType === 'not-pressed') {
			// Not-pressed: Add class back when released
			this.container.classList.add(className);
		}
		// 'always' type is always on, no action needed on release
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
