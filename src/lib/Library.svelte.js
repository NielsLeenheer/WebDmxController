/**
 * Generic Library base class with built-in Svelte reactivity
 *
 * Provides common functionality for managing collections of items with:
 * - Automatic reactivity using $state
 * - localStorage persistence
 * - CRUD operations
 */

/**
 * Base class for all libraries (Devices, Animations, Inputs, Triggers)
 */
export class Library {
	/**
	 * Reactive array of items
	 * @type {Array}
	 */
	items = $state([]);

	/**
	 * localStorage key for persistence
	 * @type {string}
	 */
	storageKey = '';

	/**
	 * @param {string} storageKey - Key for localStorage
	 */
	constructor(storageKey) {
		this.storageKey = storageKey;
		this.load();
	}

	/**
	 * Get all items
	 * @returns {Array} All items in the library
	 */
	getAll() {
		return this.items;
	}

	/**
	 * Get item by ID
	 * @param {string} id - Item ID
	 * @returns {Object|undefined} Item or undefined
	 */
	get(id) {
		return this.items.find(item => item.id === id);
	}

	/**
	 * Add item to library
	 * @param {Object} item - Item to add
	 * @returns {Object} The added item
	 */
	add(item) {
		this.items.push(item);
		this.save();
		return item;
	}

	/**
	 * Remove item by ID
	 * @param {string} id - Item ID to remove
	 */
	remove(id) {
		const index = this.items.findIndex(item => item.id === id);
		if (index !== -1) {
			this.items.splice(index, 1);
			this.save();
		}
	}

	/**
	 * Update item order
	 * @param {string} id - Item ID
	 * @param {number} newOrder - New order value
	 */
	updateOrder(id, newOrder) {
		const item = this.get(id);
		if (item) {
			item.order = newOrder;
			this.save();
		}
	}

	/**
	 * Reorder items based on drag and drop
	 * @param {Array} newOrder - New array order
	 */
	reorder(newOrder) {
		// Update order property for each item based on position in array
		newOrder.forEach((item, index) => {
			const existingItem = this.get(item.id);
			if (existingItem) {
				existingItem.order = index;
			}
		});
		this.save();
	}

	/**
	 * Clear all items
	 */
	clear() {
		this.items = [];
		this.save();
	}

	/**
	 * Save to localStorage
	 * Override in subclass to customize serialization
	 */
	save() {
		try {
			localStorage.setItem(this.storageKey, JSON.stringify(this.items));
		} catch (error) {
			console.error(`Failed to save ${this.storageKey}:`, error);
		}
	}

	/**
	 * Load from localStorage
	 * Override in subclass to customize deserialization
	 */
	load() {
		try {
			const data = localStorage.getItem(this.storageKey);
			if (data) {
				this.items = JSON.parse(data);
			}
		} catch (error) {
			console.error(`Failed to load ${this.storageKey}:`, error);
			this.items = [];
		}
	}
}
