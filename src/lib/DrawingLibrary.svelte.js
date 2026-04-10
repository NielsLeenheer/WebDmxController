/**
 * DrawingLibrary - Reactive Svelte 5 library for managing laser drawings
 *
 * Extends Library base class with drawing-specific functionality.
 * Each drawing stores SVG content that gets injected into the sampler container.
 *
 * Structure:
 * {
 *   id: string,
 *   name: string,
 *   cssIdentifier: string,     // used as SVG element id
 *   content: string,           // raw SVG/path content
 *   isDefault: boolean,        // default drawing shown without triggers/scenes
 *   order: number
 * }
 */

import { Library } from './Library.svelte.js';
import { toCSSIdentifier, toUniqueCSSIdentifier } from './css/utils.js';

export class DrawingLibrary extends Library {
	constructor() {
		super('dmx-drawings');

		// Migrate single SVG content from old localStorage key
		this._migrateFromLegacy();
	}

	/**
	 * Create a new drawing
	 * @param {string} [name] - Optional name
	 * @param {string} [content] - Optional initial SVG content
	 * @returns {Object} The created drawing
	 */
	create(name, content = '') {
		if (!name) {
			name = this._generateUniqueName('Drawing');
		}

		const existingIdentifiers = this.items.map(d => d.cssIdentifier);

		const drawing = {
			name,
			cssIdentifier: toUniqueCSSIdentifier(name, existingIdentifiers),
			content,
			isDefault: this.items.length === 0  // first drawing is default
		};

		return this.add(drawing);
	}

	/**
	 * Set a drawing as the default
	 * @param {string} id - Drawing ID to set as default
	 */
	setDefault(id) {
		for (const item of this.items) {
			item.isDefault = item.id === id;
		}
		this.save();
	}

	/**
	 * Clear the default (no drawing shown by default)
	 */
	clearDefault() {
		for (const item of this.items) {
			item.isDefault = false;
		}
		this.save();
	}

	/**
	 * Get the default drawing
	 * @returns {Object|null}
	 */
	getDefault() {
		return this.items.find(d => d.isDefault) || null;
	}

	/**
	 * Update drawing content
	 * @param {string} id - Drawing ID
	 * @param {string} content - New SVG content
	 */
	updateContent(id, content) {
		this.update(id, { content });
	}

	/**
	 * Generate CSS for drawings visibility
	 * @returns {string} CSS rules
	 */
	toCSS() {
		if (this.items.length === 0) return '';

		const lines = [];
		lines.push('svg { visibility: hidden; }');

		const defaultDrawing = this.getDefault();
		if (defaultDrawing) {
			lines.push('svg.default { visibility: visible; }');
		}

		return lines.join('\n');
	}

	/**
	 * Generate a unique name
	 */
	_generateUniqueName(baseName) {
		const existingNames = this.items.map(d => d.name);
		if (!existingNames.includes(baseName)) return baseName;

		let counter = 2;
		while (existingNames.includes(`${baseName} ${counter}`)) {
			counter++;
		}
		return `${baseName} ${counter}`;
	}

	/**
	 * Migrate from the old single-SVG localStorage key
	 */
	_migrateFromLegacy() {
		if (this.items.length > 0) return; // Already have drawings

		const legacyContent = localStorage.getItem('laser-svg-content');
		if (legacyContent && legacyContent.trim()) {
			this.create('Drawing 1', legacyContent);
			localStorage.removeItem('laser-svg-content');
		}
	}
}
