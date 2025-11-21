/**
 * Trigger System
 *
 * Maps input events to actions (running animations or setting device values)
 */

import { EventEmitter } from './EventEmitter.js';
import { toCSSIdentifier } from './css/utils.js';
import { DEVICE_TYPES } from './outputs/devices.js';
import { generateCSSProperties } from './css/generator.js';

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
	 * Check if this is an automatic (always-running) trigger
	 */
	isAutomatic() {
		return Trigger.isAutomatic(this);
	}

	/**
	 * Check if this is a manual (input-based) trigger
	 */
	isManual() {
		return Trigger.isManual(this);
	}

	/**
	 * Update CSS class name when input changes
	 */
	updateClassName() {
		this.cssClassName = Trigger.generateClassName(this);
	}

	/**
	 * Static utility methods for working with plain trigger objects
	 */

	/**
	 * Generate CSS class name from input device/control and trigger type
	 * @param {Object} trigger - Trigger object or instance
	 * @returns {string} CSS class name
	 */
	static generateClassName(trigger) {
		// For automatic (always) triggers
		if (trigger.triggerType === 'always') {
			return 'always';
		}

		// For manual triggers
		if (!trigger.inputDeviceId || !trigger.inputControlId) {
			return `trigger-${trigger.id || 'new'}`;
		}

		// Convert input IDs to valid CSS class names
		const controlPart = trigger.inputControlId.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

		// Add suffix based on trigger type
		const suffix = trigger.triggerType === 'pressed' ? 'down' :
		               trigger.triggerType === 'not-pressed' ? 'up' : 'always';

		return `${controlPart}-${suffix}`;
	}

	/**
	 * Check if trigger is automatic (always-running)
	 * @param {Object} trigger - Trigger object or instance
	 * @returns {boolean}
	 */
	static isAutomatic(trigger) {
		return trigger.triggerType === 'always';
	}

	/**
	 * Check if trigger is manual (input-based)
	 * @param {Object} trigger - Trigger object or instance
	 * @returns {boolean}
	 */
	static isManual(trigger) {
		return !Trigger.isAutomatic(trigger);
	}

	/**
	 * Generate CSS for a trigger
	 * @param {Object} trigger - Trigger object or instance
	 * @param {Array} devices - Array of device objects
	 * @param {Array} allTriggers - Array of all trigger objects
	 * @returns {string} CSS string
	 */
	static toCSS(trigger, devices = [], allTriggers = []) {
		if (trigger.actionType === 'animation') {
			return Trigger._generateAnimationCSS(trigger, devices, allTriggers);
		} else if (trigger.actionType === 'setValue') {
			return Trigger._generateSetValueCSS(trigger, devices);
		}
		return '';
	}

	/**
	 * Generate CSS for animation actions (static version)
	 * @private
	 */
	static _generateAnimationCSS(trigger, devices = [], allTriggers = []) {
		if (!trigger.animationName) return '';

		// Map device IDs to CSS IDs
		const targetSelectors = trigger.targetDeviceIds
			.map(deviceId => {
				const device = devices.find(d => d.id === deviceId);
				return device ? `#${device.cssId}` : null;
			})
			.filter(selector => selector !== null)
			.join(', ');

		if (!targetSelectors) return '';

		const iterationsValue = trigger.iterations === 'infinite' ? 'infinite' : trigger.iterations;
		const durationSec = (trigger.duration / 1000).toFixed(3);

		// Build the animation specification for this trigger
		const thisAnimation = `${trigger.animationName} ${durationSec}s ${trigger.easing} ${iterationsValue}`;

		// For manual triggers (non-automatic), check for automatic triggers on the same devices
		// and prepend their animations to preserve them
		let animationValue = thisAnimation;
		if (trigger.triggerType !== 'always') {
			// Find all automatic triggers that target any of the same devices
			const automaticAnimations = allTriggers
				.filter(t =>
					t.actionType === 'animation' &&
					t.triggerType === 'always' &&
					t.animationName &&
					// Check if this automatic trigger targets any of our devices
					t.targetDeviceIds.some(deviceId => trigger.targetDeviceIds.includes(deviceId))
				)
				.map(t => {
					const iterVal = t.iterations === 'infinite' ? 'infinite' : t.iterations;
					const durSec = (t.duration / 1000).toFixed(3);
					return `${t.animationName} ${durSec}s ${t.easing} ${iterVal}`;
				});

			// Combine automatic animations with this animation
			if (automaticAnimations.length > 0) {
				animationValue = [...automaticAnimations, thisAnimation].join(', ');
			}
		}

		// For automatic triggers (always), don't use a class selector
		// For input triggers, use the class selector
		const selector = trigger.triggerType === 'always'
			? targetSelectors
			: `.${trigger.cssClassName} ${targetSelectors}`;

		return `${selector} {
  animation: ${animationValue};
}`;
	}

	/**
	 * Generate CSS for setValue actions (static version)
	 * @private
	 */
	static _generateSetValueCSS(trigger, devices = []) {
		if (!trigger.setValueDeviceId || !trigger.channelValues) return '';

		// Find the target device
		const device = devices.find(d => d.id === trigger.setValueDeviceId);
		if (!device) return '';

		// Get device type to access controls/components
		const deviceType = DEVICE_TYPES[device.type];
		if (!deviceType) return '';

		// Convert channelValues object to array format
		const valuesArray = new Array(deviceType.channels).fill(0);
		for (const [channelStr, value] of Object.entries(trigger.channelValues)) {
			const channel = parseInt(channelStr);
			if (channel < valuesArray.length) {
				valuesArray[channel] = value;
			}
		}

		// Filter controls to only include enabled ones
		const filteredControls = Array.isArray(trigger.enabledControls)
			? deviceType.controls.filter(control =>
				trigger.enabledControls.includes(control.name)
			)
			: deviceType.controls;

		// Generate CSS properties only for enabled controls
		const properties = generateCSSProperties(
			filteredControls,
			deviceType.components,
			valuesArray,
			device.type
		);

		if (Object.keys(properties).length === 0) return '';

		// Convert properties object to CSS string
		const props = Object.entries(properties).map(([prop, value]) => `  ${prop}: ${value};`);

		const selector = `.${trigger.cssClassName} #${device.cssId}`;

		return `${selector} {
${props.join('\n')}
}`;
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
	 * Generate CSS for this trigger
	 */
	toCSS(devices = [], allTriggers = []) {
		if (this.actionType === 'animation') {
			return this._generateAnimationCSS(devices, allTriggers);
		} else if (this.actionType === 'setValue') {
			return this._generateSetValueCSS(devices);
		}
		return '';
	}

	/**
	 * Generate CSS for animation actions
	 */
	_generateAnimationCSS(devices = [], allTriggers = []) {
		if (!this.animationName) return '';

		// Map device IDs to CSS IDs
		const targetSelectors = this.targetDeviceIds
			.map(deviceId => {
				const device = devices.find(d => d.id === deviceId);
				return device ? `#${device.cssId}` : null;
			})
			.filter(selector => selector !== null)
			.join(', ');

		if (!targetSelectors) return '';

		const iterationsValue = this.iterations === 'infinite' ? 'infinite' : this.iterations;
		const durationSec = (this.duration / 1000).toFixed(3);

		// Build the animation specification for this trigger
		const thisAnimation = `${this.animationName} ${durationSec}s ${this.easing} ${iterationsValue}`;

		// For manual triggers (non-automatic), check for automatic triggers on the same devices
		// and prepend their animations to preserve them
		let animationValue = thisAnimation;
		if (this.triggerType !== 'always') {
			// Find all automatic triggers that target any of the same devices
			const automaticAnimations = allTriggers
				.filter(trigger =>
					trigger.actionType === 'animation' &&
					trigger.triggerType === 'always' &&
					trigger.animationName &&
					// Check if this automatic trigger targets any of our devices
					trigger.targetDeviceIds.some(deviceId => this.targetDeviceIds.includes(deviceId))
				)
				.map(trigger => {
					const iterVal = trigger.iterations === 'infinite' ? 'infinite' : trigger.iterations;
					const durSec = (trigger.duration / 1000).toFixed(3);
					return `${trigger.animationName} ${durSec}s ${trigger.easing} ${iterVal}`;
				});

			// Combine automatic animations with this animation
			if (automaticAnimations.length > 0) {
				animationValue = [...automaticAnimations, thisAnimation].join(', ');
			}
		}

		// For automatic triggers (always), don't use a class selector
		// For input triggers, use the class selector
		const selector = this.triggerType === 'always'
			? targetSelectors
			: `.${this.cssClassName} ${targetSelectors}`;

		return `${selector} {
  animation: ${animationValue};
}`;
	}

	/**
	 * Generate CSS for setValue actions
	 */
	_generateSetValueCSS(devices = []) {
		if (!this.setValueDeviceId || !this.channelValues) return '';

		// Find the target device
		const device = devices.find(d => d.id === this.setValueDeviceId);
		if (!device) return '';

		// Get device type to access controls/components
		const deviceType = DEVICE_TYPES[device.type];
		if (!deviceType) return '';

		// Convert channelValues object to array format
		const valuesArray = new Array(deviceType.channels).fill(0);
		for (const [channelStr, value] of Object.entries(this.channelValues)) {
			const channel = parseInt(channelStr);
			if (channel < valuesArray.length) {
				valuesArray[channel] = value;
			}
		}

		// Filter controls to only include enabled ones
		const filteredControls = Array.isArray(this.enabledControls)
			? deviceType.controls.filter(control =>
				this.enabledControls.includes(control.name)
			)
			: deviceType.controls;

		// Generate CSS properties only for enabled controls
		const properties = generateCSSProperties(
			filteredControls,
			deviceType.components,
			valuesArray,
			device.type
		);

		if (Object.keys(properties).length === 0) return '';

		// Convert properties object to CSS string
		const props = Object.entries(properties).map(([prop, value]) => `  ${prop}: ${value};`);

		const selector = `.${this.cssClassName} #${device.cssId}`;

		return `${selector} {
${props.join('\n')}
}`;
	}

	/**
	 * Deserialize from JSON
	 */
	static fromJSON(json) {
		return new Trigger(json);
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
	 * Reorder triggers
	 */
	reorder(newOrder) {
		this.triggers.clear();
		newOrder.forEach(trigger => {
			this.triggers.set(trigger.id, trigger);
		});
		this.save();
		this._emit('changed', { type: 'reorder' });
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

	/**
	 * Generate CSS for all triggers
	 */
	toCSS(devices = []) {
		const allTriggers = this.getAll();
		const cssRules = [];

		// Group automatic animation triggers by device to combine them
		const automaticAnimationsByDevice = new Map(); // deviceId -> array of triggers

		// Separate automatic animations from other triggers
		const automaticAnimations = [];
		const otherTriggers = [];

		for (const trigger of allTriggers) {
			if (trigger.actionType === 'animation' &&
			    trigger.triggerType === 'always' &&
			    trigger.animationName) {
				automaticAnimations.push(trigger);
			} else {
				otherTriggers.push(trigger);
			}
		}

		// Group automatic animations by device
		for (const trigger of automaticAnimations) {
			for (const deviceId of trigger.targetDeviceIds) {
				if (!automaticAnimationsByDevice.has(deviceId)) {
					automaticAnimationsByDevice.set(deviceId, []);
				}
				automaticAnimationsByDevice.get(deviceId).push(trigger);
			}
		}

		// Generate combined CSS for automatic animations
		for (const [deviceId, triggers] of automaticAnimationsByDevice.entries()) {
			const device = devices.find(d => d.id === deviceId);
			if (!device) continue;

			// Combine all automatic animations for this device
			const animationSpecs = triggers.map(trigger => {
				const iterVal = trigger.iterations === 'infinite' ? 'infinite' : trigger.iterations;
				const durSec = (trigger.duration / 1000).toFixed(3);
				return `${trigger.animationName} ${durSec}s ${trigger.easing} ${iterVal}`;
			});

			const animationValue = animationSpecs.join(', ');
			cssRules.push(`#${device.cssId} {
  animation: ${animationValue};
}`);
		}

		// Generate CSS for all other triggers (including manual animations)
		for (const trigger of otherTriggers) {
			const css = trigger.toCSS(devices, allTriggers);
			if (css) {
				cssRules.push(css);
			}
		}

		return cssRules.join('\n\n');
	}
}
