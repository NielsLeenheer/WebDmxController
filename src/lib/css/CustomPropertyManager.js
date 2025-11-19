/**
 * Custom Property Manager
 *
 * Manages custom CSS properties for direct mode input mappings
 */

export class CustomPropertyManager {
	constructor() {
		this.properties = new Map(); // propertyName -> value
		this.styleElement = null;
	}

	/**
	 * Initialize by creating a style element
	 */
	initialize() {
		this.styleElement = document.createElement('style');
		this.styleElement.id = 'dmx-custom-properties';
		document.head.appendChild(this.styleElement);
		this._updateStyle();
	}

	/**
	 * Set a custom property value
	 */
	setProperty(name, value) {
		if (!name.startsWith('--')) {
			name = `--${name}`;
		}

		this.properties.set(name, value);
		this._updateStyle();
	}

	/**
	 * Get a custom property value
	 */
	getProperty(name) {
		if (!name.startsWith('--')) {
			name = `--${name}`;
		}

		return this.properties.get(name);
	}

	/**
	 * Update the style element
	 */
	_updateStyle() {
		if (!this.styleElement) return;

		const props = Array.from(this.properties.entries())
			.map(([name, value]) => `  ${name}: ${value};`)
			.join('\n');

		this.styleElement.textContent = `:root {\n${props}\n}`;
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
		this.properties.clear();
		this._updateStyle();
	}

	/**
	 * Cleanup
	 */
	destroy() {
		if (this.styleElement) {
			this.styleElement.remove();
			this.styleElement = null;
		}
		this.properties.clear();
	}
}
