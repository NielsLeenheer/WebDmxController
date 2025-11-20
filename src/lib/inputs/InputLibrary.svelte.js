/**
 * InputLibrary - Reactive Svelte 5 library for managing inputs
 *
 * Extends Library base class with input-specific functionality.
 * Stores inputs as plain objects (not class instances) for proper reactivity.
 */

import { Library } from '../Library.svelte.js';
import { Input } from '../inputs.js';
import { toCSSIdentifier } from '../css/utils.js';

export class InputLibrary extends Library {
	constructor() {
		super('webdmx-inputs');
	}

	/**
	 * Create and add a new input
	 * @param {Object} config - Input configuration
	 * @returns {Object} Created input object
	 */
	create(config = {}) {
		const id = config.id || `input-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		const name = config.name || 'Untitled Input';

		// Determine if this is a button input
		const isButton = Input.isButtonInput({ inputControlId: config.inputControlId });
		const buttonMode = config.buttonMode || 'momentary';

		// Generate CSS identifiers
		let cssClassOn = null;
		let cssClassOff = null;
		let cssClassDown = null;
		let cssClassUp = null;
		let cssProperty = null;

		if (isButton) {
			if (buttonMode === 'toggle') {
				cssClassOn = config.cssClassOn || `${toCSSIdentifier(name)}-on`;
				cssClassOff = config.cssClassOff || `${toCSSIdentifier(name)}-off`;
			} else {
				cssClassDown = config.cssClassDown || `${toCSSIdentifier(name)}-down`;
				cssClassUp = config.cssClassUp || `${toCSSIdentifier(name)}-up`;
			}
		} else {
			cssProperty = config.cssProperty || `--${toCSSIdentifier(name)}`;
		}

		const input = {
			id,
			name,
			inputDeviceId: config.inputDeviceId || null,
			inputControlId: config.inputControlId || null,
			inputDeviceName: config.inputDeviceName || null,
			color: config.color || null,
			buttonMode,
			cssClassOn,
			cssClassOff,
			cssClassDown,
			cssClassUp,
			cssProperty,
			order: this.items.length
		};

		this.items.push(input);
		this.save();
		return input;
	}

	/**
	 * Add an existing input (from external source)
	 * @param {Object} input - Input object or Input class instance
	 * @returns {Object} Added input object
	 */
	add(input) {
		// Convert Input class instance to plain object if needed
		const plainInput = input.toJSON ? input.toJSON() : input;

		// Ensure order is set
		if (plainInput.order === undefined) {
			plainInput.order = this.items.length;
		}

		this.items.push(plainInput);
		this.save();
		return plainInput;
	}

	/**
	 * Get input by ID
	 * @param {string} id - Input ID
	 */
	get(id) {
		return this.items.find(item => item.id === id);
	}

	/**
	 * Check if input exists
	 * @param {string} id - Input ID
	 */
	has(id) {
		return this.items.some(item => item.id === id);
	}

	/**
	 * Remove an input by ID
	 * @param {string} id - Input ID to remove
	 */
	remove(id) {
		const index = this.items.findIndex(item => item.id === id);
		if (index !== -1) {
			this.items.splice(index, 1);
			this.save();
		}
	}

	/**
	 * Update an existing input
	 * @param {Object} updatedInput - Updated input object
	 */
	update(updatedInput) {
		const index = this.items.findIndex(item => item.id === updatedInput.id);
		if (index !== -1) {
			// Preserve order
			updatedInput.order = this.items[index].order;
			this.items[index] = updatedInput;
			this.save();
		}
	}

	/**
	 * Find input by device and control ID
	 * @param {string} deviceId - Device ID
	 * @param {string} controlId - Control ID
	 */
	findByDeviceControl(deviceId, controlId) {
		return this.items.find(i =>
			i.inputDeviceId === deviceId && i.inputControlId === controlId
		);
	}

	/**
	 * Reorder inputs based on array of IDs
	 * @param {Array<string>} orderedIds - Array of input IDs in new order
	 */
	reorder(orderedIds) {
		orderedIds.forEach((id, index) => {
			const input = this.get(id);
			if (input) {
				input.order = index;
			}
		});
		this.save();
	}

	/**
	 * Update CSS identifiers for an input based on its name and button mode
	 * @param {Object} input - Input object
	 */
	updateCSSIdentifiers(input) {
		const isButton = Input.isButtonInput(input);

		if (isButton) {
			if (input.buttonMode === 'toggle') {
				input.cssClassOn = `${toCSSIdentifier(input.name)}-on`;
				input.cssClassOff = `${toCSSIdentifier(input.name)}-off`;
				input.cssClassDown = null;
				input.cssClassUp = null;
			} else {
				input.cssClassDown = `${toCSSIdentifier(input.name)}-down`;
				input.cssClassUp = `${toCSSIdentifier(input.name)}-up`;
				input.cssClassOn = null;
				input.cssClassOff = null;
			}
			input.cssProperty = null;
		} else {
			// Slider/knob inputs
			input.cssProperty = `--${toCSSIdentifier(input.name)}`;
			input.cssClassDown = null;
			input.cssClassUp = null;
			input.cssClassOn = null;
			input.cssClassOff = null;
		}

		this.save();
	}

	/**
	 * Deserialize input data from storage
	 * @param {Object} inputData - Serialized input data
	 * @param {number} index - Array index for order
	 */
	deserializeItem(inputData, index) {
		// Use Input.fromJSON to handle backward compatibility
		const input = Input.fromJSON(inputData);

		// Convert to plain object
		return {
			id: input.id,
			name: input.name,
			inputDeviceId: input.inputDeviceId,
			inputControlId: input.inputControlId,
			inputDeviceName: input.inputDeviceName,
			color: input.color,
			buttonMode: input.buttonMode,
			cssClassOn: input.cssClassOn,
			cssClassOff: input.cssClassOff,
			cssClassDown: input.cssClassDown,
			cssClassUp: input.cssClassUp,
			cssProperty: input.cssProperty,
			order: inputData.order !== undefined ? inputData.order : index
		};
	}

	/**
	 * Clear all inputs
	 */
	clear() {
		this.items = [];
		this.save();
	}
}
