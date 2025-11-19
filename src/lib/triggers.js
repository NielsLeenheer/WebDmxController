/**
 * Trigger System
 *
 * Maps input events to actions (running animations or setting device values)
 */

import { toCSSIdentifier } from './css/utils.js';

/**
 * Represents a trigger that executes an action when an input event occurs
 */
export class Trigger {
	constructor(config = {}) {
		this.id = config.id || `trigger-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		this.name = config.name || 'Untitled Trigger';
		this.version = config.version || 0; // Version counter for reactivity

		// Trigger condition
		this.triggerType = config.triggerType || 'pressed'; // 'pressed', 'not-pressed', 'always'

		// For manual triggers (not 'always')
		this.inputDeviceId = config.inputDeviceId || null;
		this.inputControlId = config.inputControlId || null;

		// Action type
		this.actionType = config.actionType || 'animation'; // 'animation' or 'setValue'

		// Animation action settings
		this.animationName = config.animationName || null;
		this.targetDeviceIds = config.targetDeviceIds || []; // Array of device IDs (for animations)
		this.duration = config.duration || 1000; // ms
		this.easing = config.easing || 'linear';
		this.iterations = config.iterations || 1; // number or 'infinite'

		// SetValue action settings
		this.setValueDeviceId = config.setValueDeviceId || null; // Single device ID for setValue
		this.channelValues = config.channelValues || {}; // Object mapping channel index to value (0-255)
		this.enabledControls = config.enabledControls || []; // Array of control names that should be set

		// CSS class name for trigger (auto-generated from input)
		this.cssClassName = config.cssClassName || this._generateClassName();
	}

	/**
	 * Generate CSS class name from input device/control and trigger type
	 */
	_generateClassName() {
		// For automatic (always) triggers
		if (this.triggerType === 'always') {
			return 'always';
		}

		// For manual triggers
		if (!this.inputDeviceId || !this.inputControlId) {
			return `trigger-${this.id}`;
		}

		// Convert input IDs to valid CSS class names
		const controlPart = this.inputControlId.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

		// Add suffix based on trigger type
		const suffix = this.triggerType === 'pressed' ? 'down' :
		               this.triggerType === 'not-pressed' ? 'up' : 'always';

		return `${controlPart}-${suffix}`;
	}

	/**
	 * Update CSS class name when input changes
	 */
	updateClassName() {
		this.cssClassName = this._generateClassName();
	}

	/**
	 * Check if this is an automatic (always-running) trigger
	 */
	isAutomatic() {
		return this.triggerType === 'always';
	}

	/**
	 * Check if this is a manual (input-based) trigger
	 */
	isManual() {
		return !this.isAutomatic();
	}

	/**
	 * Serialize to JSON for storage
	 */
	toJSON() {
		return {
			id: this.id,
			name: this.name,
			version: this.version,
			triggerType: this.triggerType,
			inputDeviceId: this.inputDeviceId,
			inputControlId: this.inputControlId,
			actionType: this.actionType,
			animationName: this.animationName,
			targetDeviceIds: this.targetDeviceIds,
			duration: this.duration,
			easing: this.easing,
			iterations: this.iterations,
			setValueDeviceId: this.setValueDeviceId,
			channelValues: this.channelValues,
			enabledControls: this.enabledControls,
			cssClassName: this.cssClassName
		};
	}

	/**
	 * Deserialize from JSON
	 */
	static fromJSON(json) {
		return new Trigger(json);
	}
}

/**
 * Event emitter helper
 */
class EventEmitter {
	constructor() {
		this.listeners = {};
	}

	on(event, callback) {
		if (!this.listeners[event]) {
			this.listeners[event] = [];
		}
		this.listeners[event].push(callback);
	}

	off(event, callback) {
		if (!this.listeners[event]) return;
		this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
	}

	_emit(event, data) {
		if (!this.listeners[event]) return;
		this.listeners[event].forEach(callback => callback(data));
	}
}

/**
 * Manages the collection of triggers
 */
export class TriggerLibrary extends EventEmitter {
	constructor() {
		super();
		this.triggers = new Map();
		this.storageKey = 'webdmx-triggers';
		this.load();
	}

	/**
	 * Add a new trigger
	 */
	add(trigger) {
		this.triggers.set(trigger.id, trigger);
		this.save();
		this._emit('changed', { type: 'add', trigger });
		return trigger;
	}

	/**
	 * Get a trigger by ID
	 */
	get(id) {
		return this.triggers.get(id);
	}

	/**
	 * Get all triggers
	 */
	getAll() {
		return Array.from(this.triggers.values());
	}

	/**
	 * Update an existing trigger
	 */
	update(trigger) {
		if (this.triggers.has(trigger.id)) {
			trigger.version = (trigger.version || 0) + 1;
			this.triggers.set(trigger.id, trigger);
			this.save();
			this._emit('changed', { type: 'update', trigger });
		}
	}

	/**
	 * Remove a trigger
	 */
	remove(id) {
		const trigger = this.triggers.get(id);
		if (trigger) {
			this.triggers.delete(id);
			this.save();
			this._emit('changed', { type: 'remove', trigger });
		}
	}

	/**
	 * Save to localStorage
	 */
	save() {
		const data = Array.from(this.triggers.values()).map(trigger => trigger.toJSON());
		localStorage.setItem(this.storageKey, JSON.stringify(data));
	}

	/**
	 * Load from localStorage
	 */
	load() {
		try {
			const data = localStorage.getItem(this.storageKey);
			if (data) {
				const triggers = JSON.parse(data);
				this.triggers.clear();
				triggers.forEach(triggerData => {
					const trigger = Trigger.fromJSON(triggerData);
					this.triggers.set(trigger.id, trigger);
				});
			}
		} catch (error) {
			console.error('Failed to load triggers:', error);
		}
	}

	/**
	 * Clear all triggers
	 */
	clear() {
		this.triggers.clear();
		this.save();
	}
}
