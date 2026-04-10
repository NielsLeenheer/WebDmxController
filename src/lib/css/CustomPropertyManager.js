/**
 * Custom Property Manager
 *
 * Manages custom CSS properties for direct mode input mappings.
 * Uses document.documentElement.style.setProperty() for efficient per-property
 * updates — the browser tracks individual custom property dependencies so
 * changing --gyro-x won't invalidate elements that only use --audio-bass.
 *
 * All changes within a frame are batched into a single RAF callback to avoid
 * multiple style invalidation passes when sensor events fire in rapid succession.
 */

export class CustomPropertyManager {
	constructor() {
		this.properties = new Map(); // propertyName -> current value
		this._pending = new Map();   // propertyName -> value (dirty this frame)
		this._rafId = null;
	}

	/**
	 * Initialize (no-op — uses inline styles on :root directly)
	 */
	initialize() {}

	/**
	 * Set a custom property value. The DOM update is deferred to the next
	 * animation frame so that multiple changes within the same frame are
	 * applied in a single batch.
	 */
	setProperty(name, value) {
		if (!name.startsWith('--')) {
			name = `--${name}`;
		}

		if (this.properties.get(name) === value) return;

		this.properties.set(name, value);
		this._pending.set(name, value);
		this._scheduleFlush();
	}

	/**
	 * Get a custom property value (reads from the in-memory map, not DOM)
	 */
	getProperty(name) {
		if (!name.startsWith('--')) {
			name = `--${name}`;
		}

		return this.properties.get(name);
	}

	/**
	 * Get all properties
	 */
	getAll() {
		return Array.from(this.properties.entries()).map(([name, value]) => ({ name, value }));
	}

	/**
	 * Clear all properties
	 */
	clear() {
		this._cancelFlush();
		this._pending.clear();
		for (const name of this.properties.keys()) {
			document.documentElement.style.removeProperty(name);
		}
		this.properties.clear();
	}

	/**
	 * Cleanup
	 */
	destroy() {
		this.clear();
	}

	_scheduleFlush() {
		if (this._rafId !== null) return;
		this._rafId = requestAnimationFrame(() => {
			this._rafId = null;
			this._flush();
		});
	}

	_flush() {
		const style = document.documentElement.style;
		for (const [name, value] of this._pending) {
			style.setProperty(name, value);
		}
		this._pending.clear();
	}

	_cancelFlush() {
		if (this._rafId !== null) {
			cancelAnimationFrame(this._rafId);
			this._rafId = null;
		}
	}
}
