/**
 * EventEmitter - Simple event emitter base class
 * 
 * Provides basic pub/sub functionality for classes that need to emit events.
 */

export class EventEmitter {
	#listeners = new Map();

	/**
	 * Subscribe to an event
	 * @param {string} event - Event name
	 * @param {Function} callback - Callback function
	 */
	on(event, callback) {
		if (!this.#listeners.has(event)) {
			this.#listeners.set(event, []);
		}
		this.#listeners.get(event).push(callback);
	}

	/**
	 * Unsubscribe from an event
	 * @param {string} event - Event name
	 * @param {Function} callback - Callback to remove
	 */
	off(event, callback) {
		if (!this.#listeners.has(event)) return;
		const callbacks = this.#listeners.get(event);
		const index = callbacks.indexOf(callback);
		if (index !== -1) {
			callbacks.splice(index, 1);
		}
	}

	/**
	 * Emit an event
	 * @param {string} event - Event name
	 * @param {*} data - Event data
	 * @protected
	 */
	_emit(event, data) {
		if (!this.#listeners.has(event)) return;
		for (const callback of this.#listeners.get(event)) {
			callback(data);
		}
	}
}
