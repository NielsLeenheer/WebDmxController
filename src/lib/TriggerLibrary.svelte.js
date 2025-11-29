/**
 * TriggerLibrary - Reactive Svelte 5 library for managing triggers
 *
 * Extends Library base class with trigger-specific functionality.
 * Stores triggers as plain objects (not class instances) for proper reactivity.
 *
 * Trigger Types:
 * - 'auto': Automatic triggers (always running)
 * - 'action': Action triggers (triggered by button state)
 * - 'value': Value-based triggers (map input values to control values continuously)
 *
 * Structure:
 * {
 *   type: 'auto' | 'action' | 'value',
 *   enabled: boolean,
 *   input: {
 *     id,                           // input id from InputLibrary
 *     state,                        // for action: 'up' | 'down' | 'on' | 'off'
 *     value                         // for value: input value key (e.g., 'value', 'pressure')
 *   },
 *   output: {
 *     id                           // output device id from DeviceLibrary
 *   },
 *   action: {
 *     type: 'animation' | 'values' | 'copy',
 *     animation: { id, duration, easing, iterations },  // for type='animation'
 *     values: { ... },              // for type='values'
 *     copy: { control, component, invert }              // for type='copy' (value triggers)
 *   },
 *   order: number
 * }
 */

import { Library } from './Library.svelte.js';
import { generateCSSTriggers, generateValueTriggersCSS } from './triggers/css.js';

export class TriggerLibrary extends Library {
	constructor() {
		super('dmx-triggers');
	}

	/**
	 * Create and add a new trigger
	 * @param {Object} config - Trigger configuration
	 * @returns {Object} Created trigger object
	 */
	create(config = {}) {
		const type = config.type || 'action';

		// Automatic triggers (always running)
		if (type === 'auto') {
			const actionType = config.action?.type || 'animation';
			return this.add({
				type: 'auto',
				enabled: config.enabled ?? true,
				output: {
					id: config.output?.id || null
				},
				action: {
					type: actionType,
					animation: actionType === 'animation' ? {
						id: config.action?.animation?.id || null,
						duration: config.action?.animation?.duration || 1000,
						easing: config.action?.animation?.easing || 'linear',
						iterations: config.action?.animation?.iterations || 'infinite'
					} : null,
					values: actionType === 'values' ? (config.action?.values || {}) : null
				},
				order: this.items.length
			});
		}

		// Value triggers map input values to control values continuously
		if (type === 'value') {
			return this.add({
				type: 'value',
				enabled: config.enabled ?? true,
				input: {
					id: config.input?.id || null,
					value: config.input?.value || 'value'
				},
				output: {
					id: config.output?.id || null
				},
				action: {
					type: 'copy',
					copy: {
						control: config.action?.copy?.control || null,
						component: config.action?.copy?.component || null,
						invert: config.action?.copy?.invert || false
					}
				},
				order: this.items.length
			});
		}

		// Action triggers (triggered by button state)
		const actionType = config.action?.type || 'animation';

		return this.add({
			type: 'action',
			enabled: config.enabled ?? true,
			input: {
				id: config.input?.id || null,
				state: config.input?.state || 'down'
			},
			output: {
				id: config.output?.id || null
			},
			action: {
				type: actionType,
				animation: actionType === 'animation' ? {
					id: config.action?.animation?.id || null,
					duration: config.action?.animation?.duration || 1000,
					easing: config.action?.animation?.easing || 'linear',
					iterations: config.action?.animation?.iterations || 'infinite'
				} : null,
				values: actionType === 'values' ? (config.action?.values || {}) : null
			},
			order: this.items.length
		});
	}


	/**
	 * Generate CSS for all triggers
	 * @param {Array} devices - Array of device objects
	 * @param {Object} animationLibrary - AnimationLibrary instance to resolve animation cssIdentifiers
	 * @param {Object} inputLibrary - InputLibrary instance to resolve input names
	 * @returns {string} Combined CSS
	 */
	toCSS(devices = [], animationLibrary = null, inputLibrary = null) {
		const allTriggers = this.getAll().filter(trigger => trigger.enabled !== false);

		// Separate value triggers from other triggers
		const valueTriggers = allTriggers.filter(t => t.type === 'value');
		const otherTriggers = allTriggers.filter(t => t.type !== 'value');

		// Get unique device IDs that are used in non-value triggers
		const deviceIds = new Set(otherTriggers.map(t => t.output?.id).filter(id => id));

		// Generate CSS for each device (traditional triggers)
		const cssRules = [];
		for (const deviceId of deviceIds) {
			const device = devices.find(d => d.id === deviceId);
			if (!device) continue;

			const css = generateCSSTriggers(device, otherTriggers, animationLibrary, inputLibrary);
			if (css) cssRules.push(css);
		}

		// Generate CSS for value-based triggers (grouped by device)
		const valueDeviceIds = new Set(valueTriggers.map(t => t.output?.id).filter(id => id));
		for (const deviceId of valueDeviceIds) {
			const device = devices.find(d => d.id === deviceId);
			if (!device) continue;

			const deviceValueTriggers = valueTriggers.filter(t => t.output?.id === deviceId);
			const css = generateValueTriggersCSS(deviceValueTriggers, device, inputLibrary);
			if (css) cssRules.push(css);
		}

		return cssRules.join('\n\n');
	}

	/**
	 * Deserialize trigger data from storage
	 * @param {Object} data - Serialized trigger data
	 * @param {number} index - Array index for order
	 */
	deserializeItem(data, index) {
		// Determine trigger type (handle legacy triggerType migration)
		let type = data.type;
		if (!type && data.triggerType) {
			// Migrate old triggerType to new type
			if (data.triggerType === 'value') {
				type = 'value';
			} else if (data.triggerType === 'always') {
				type = 'auto';
			} else {
				type = 'action';
			}
		}
		type = type || 'action';

		// Handle automatic triggers
		if (type === 'auto') {
			const actionType = data.action?.type || data.actionType || 'animation';

			// Handle values deserialization with deep copy
			let values = null;
			if (actionType === 'values') {
				values = {};
				const sourceValues = data.action?.values || data.values || {};
				for (const [key, value] of Object.entries(sourceValues)) {
					if (typeof value === 'object' && value !== null) {
						values[key] = { ...value };
					} else {
						values[key] = value;
					}
				}
			}

			return {
				id: data.id || crypto.randomUUID(),
				type: 'auto',
				enabled: data.enabled !== undefined ? data.enabled : true,
				output: {
					id: data.output?.id || data.output?.device?.id || data.deviceId || null
				},
				action: {
					type: actionType,
					animation: actionType === 'animation' ? {
						id: data.action?.animation?.id || data.animation?.id || data.animationName || null,
						duration: data.action?.animation?.duration || data.animation?.duration || data.duration || 1000,
						easing: data.action?.animation?.easing || data.animation?.easing || data.easing || 'linear',
						iterations: data.action?.animation?.iterations || data.animation?.iterations || data.iterations || 'infinite'
					} : null,
					values
				},
				order: data.order !== undefined ? data.order : index
			};
		}

		// Handle value-based triggers
		if (type === 'value') {
			return {
				id: data.id || crypto.randomUUID(),
				type: 'value',
				enabled: data.enabled !== undefined ? data.enabled : true,
				input: {
					id: data.input?.id || data.inputId || null,
					value: data.input?.value || data.inputValueKey || 'value'
				},
				output: {
					id: data.output?.id || data.output?.device?.id || data.deviceId || null
				},
				action: {
					type: 'copy',
					copy: {
						control: data.action?.copy?.control || data.output?.control?.id || data.controlId || data.controlName || null,
						component: data.action?.copy?.component || data.output?.control?.value || data.controlValueId || data.controlChannel || null,
						invert: data.action?.copy?.invert || data.action?.invert || data.invert || false
					}
				},
				order: data.order !== undefined ? data.order : index
			};
		}

		// Handle action triggers
		const actionType = data.action?.type || data.actionType || 'animation';

		// Handle values deserialization with deep copy
		let values = null;
		if (actionType === 'values') {
			values = {};
			const sourceValues = data.action?.values || data.values || {};
			for (const [key, value] of Object.entries(sourceValues)) {
				if (typeof value === 'object' && value !== null) {
					values[key] = { ...value };
				} else {
					values[key] = value;
				}
			}
		}

		// Determine input state (migrate from old triggerType)
		let inputState = data.input?.state;
		if (!inputState && data.triggerType) {
			// Migrate old triggerType to input.state
			if (data.triggerType === 'pressed') {
				inputState = 'down';
			} else if (data.triggerType === 'not-pressed') {
				inputState = 'up';
			}
		}
		inputState = inputState || 'down';

		return {
			id: data.id || crypto.randomUUID(),
			type: 'action',
			enabled: data.enabled !== undefined ? data.enabled : true,
			input: {
				id: data.input?.id || data.inputId || null,
				state: inputState
			},
			output: {
				id: data.output?.id || data.output?.device?.id || data.deviceId || null
			},
			action: {
				type: actionType,
				animation: actionType === 'animation' ? {
					id: data.action?.animation?.id || data.animation?.id || data.animationName || null,
					duration: data.action?.animation?.duration || data.animation?.duration || data.duration || 1000,
					easing: data.action?.animation?.easing || data.animation?.easing || data.easing || 'linear',
					iterations: data.action?.animation?.iterations || data.animation?.iterations || data.iterations || 'infinite'
				} : null,
				values
			},
			order: data.order !== undefined ? data.order : index
		};
	}
}