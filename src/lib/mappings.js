/**
 * Mapping System
 *
 * Maps input controls to either:
 * 1. Trigger mode - Run animation when input is triggered
 * 2. Direct mode - Continuously control a CSS custom property
 */

import { DEVICE_TYPES } from './devices.js';
import { generateCSSProperties } from './controlCssMapping.js';

export const INPUT_COLOR_PALETTE = [
	'red', 'orange', 'yellow', 'lime', 'green', 'spring',
	'turquoise', 'cyan', 'sky', 'blue', 'violet', 'purple',
	'magenta', 'pink'
];

/**
 * Represents a single input-to-output mapping
 */
export class InputMapping {
	constructor(config = {}) {
		this.id = config.id || `mapping-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		this.name = config.name || 'Untitled Mapping';
		this.mode = config.mode || 'trigger'; // 'trigger', 'direct', or 'input'

		// Input source
		this.inputDeviceId = config.inputDeviceId || null;
		this.inputControlId = config.inputControlId || null;
		this.inputDeviceName = config.inputDeviceName || null; // Store device name for display

		// Visual color for the input (shown in UI and on hardware)
		// undefined = generate random, null = no color support, string = use that color
		if (!('color' in config) || config.color === undefined) {
			this.color = this._generateRandomColor();
		} else {
			this.color = config.color; // Could be null or an actual color string
		}

		// Trigger mode settings
		this.triggerType = config.triggerType || 'pressed'; // 'pressed', 'not-pressed', 'always'
		this.actionType = config.actionType || 'animation'; // 'animation' or 'setValue'

		// Animation action settings
		this.animationName = config.animationName || null;
		this.duration = config.duration || 1000; // ms
		this.easing = config.easing || 'linear';
		this.iterations = config.iterations || 1; // number or 'infinite'
		this.targetDeviceIds = config.targetDeviceIds || []; // Array of device IDs (for animations)

		// SetValue action settings
		this.setValueDeviceId = config.setValueDeviceId || null; // Single device ID for setValue
		this.channelValues = config.channelValues || {}; // Object mapping channel index to value (0-255)
		this.enabledControls = config.enabledControls || []; // Array of control names that should be set

		// Direct mode settings
		this.propertyName = config.propertyName || '--value'; // CSS custom property name
		this.propertyType = config.propertyType || 'percentage'; // 'percentage', 'degrees', 'number'
		this.range = config.range || [0, 100]; // [min, max] output range

		// CSS class name for trigger mode (auto-generated from input)
		this.cssClassName = config.cssClassName || this._generateClassName();

		// Button mode for input-mode button inputs: 'momentary' or 'toggle'
		// Momentary: down/up states, Toggle: on/off states
		this.buttonMode = config.buttonMode || 'momentary';

		// Stored CSS identifiers (generated from name and stored)
		// For button inputs in input mode:
		if (this.mode === 'input' && this.isButtonInput()) {
			if (this.buttonMode === 'toggle') {
				// Toggle mode: on/off class names
				this.cssClassOn = config.cssClassOn || this._generateButtonOnClass();
				this.cssClassOff = config.cssClassOff || this._generateButtonOffClass();
				this.cssClassDown = null;
				this.cssClassUp = null;
			} else {
				// Momentary mode: down/up class names (default)
				this.cssClassDown = config.cssClassDown || this._generateButtonDownClass();
				this.cssClassUp = config.cssClassUp || this._generateButtonUpClass();
				this.cssClassOn = null;
				this.cssClassOff = null;
			}
			this.cssProperty = null;
		} else if (!this.isButtonInput()) {
			// For slider/knob inputs: store the CSS custom property name
			this.cssProperty = config.cssProperty || this._generatePropertyName();
			this.cssClassDown = null;
			this.cssClassUp = null;
			this.cssClassOn = null;
			this.cssClassOff = null;
		} else {
			// For trigger mode buttons, keep old behavior
			this.cssClassDown = config.cssClassDown || (this.isButtonInput() ? this._generateButtonDownClass() : null);
			this.cssClassUp = config.cssClassUp || (this.isButtonInput() ? this._generateButtonUpClass() : null);
			this.cssClassOn = null;
			this.cssClassOff = null;
			this.cssProperty = null;
		}
	}

	/**
	 * Generate a random named color
	 * Named colors work across all devices (MIDI, Stream Deck)
	 */
	_generateRandomColor() {
		return INPUT_COLOR_PALETTE[Math.floor(Math.random() * INPUT_COLOR_PALETTE.length)];
	}

	/**
	 * Generate CSS class name from input device/control and trigger type
	 */
	_generateClassName() {
		if (!this.inputDeviceId || !this.inputControlId) {
			return `mapping-${this.id}`;
		}

		// Convert input IDs to valid CSS class names
		const controlPart = this.inputControlId.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

		// For input mode, don't add trigger suffix
		if (this.mode === 'input') {
			return controlPart;
		}

		// For trigger mode, add suffix based on trigger type
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
	 * Generate CSS custom property name from input name (for slider/knob inputs)
	 */
	_generatePropertyName() {
		if (!this.name) return '--value';

		const propertyName = this.name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with dashes
			.replace(/^-+|-+$/g, '');      // Remove leading/trailing dashes

		return `--${propertyName}`;
	}

	/**
	 * Generate CSS class name for button down state (for button inputs)
	 */
	_generateButtonDownClass() {
		if (!this.name) return '';

		const namePart = this.name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with dashes
			.replace(/^-+|-+$/g, '');      // Remove leading/trailing dashes

		return `${namePart}-down`;
	}

	/**
	 * Generate CSS class name for button up state (for button inputs)
	 */
	_generateButtonUpClass() {
		if (!this.name) return '';

		const namePart = this.name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with dashes
			.replace(/^-+|-+$/g, '');      // Remove leading/trailing dashes

		return `${namePart}-up`;
	}

	/**
	 * Generate CSS class name for button on state (for toggle button inputs)
	 */
	_generateButtonOnClass() {
		if (!this.name) return '';

		const namePart = this.name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with dashes
			.replace(/^-+|-+$/g, '');      // Remove leading/trailing dashes

		return `${namePart}-on`;
	}

	/**
	 * Generate CSS class name for button off state (for toggle button inputs)
	 */
	_generateButtonOffClass() {
		if (!this.name) return '';

		const namePart = this.name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with dashes
			.replace(/^-+|-+$/g, '');      // Remove leading/trailing dashes

		return `${namePart}-off`;
	}

	/**
	 * Update stored CSS identifiers when name changes
	 */
	updateCSSIdentifiers() {
		if (this.mode === 'input' && this.isButtonInput()) {
			if (this.buttonMode === 'toggle') {
				this.cssClassOn = this._generateButtonOnClass();
				this.cssClassOff = this._generateButtonOffClass();
				this.cssClassDown = null;
				this.cssClassUp = null;
			} else {
				this.cssClassDown = this._generateButtonDownClass();
				this.cssClassUp = this._generateButtonUpClass();
				this.cssClassOn = null;
				this.cssClassOff = null;
			}
			this.cssProperty = null;
		} else if (this.isButtonInput()) {
			// Trigger mode buttons
			this.cssClassDown = this._generateButtonDownClass();
			this.cssClassUp = this._generateButtonUpClass();
			this.cssClassOn = null;
			this.cssClassOff = null;
			this.cssProperty = null;
		} else {
			// Slider/knob inputs
			this.cssProperty = this._generatePropertyName();
			this.cssClassDown = null;
			this.cssClassUp = null;
			this.cssClassOn = null;
			this.cssClassOff = null;
		}
	}

	/**
	 * Convert mapping to CSS
	 * Trigger mode: generates CSS class with animation
	 * Direct mode: not used (values set via JS)
	 */
	toCSS(devices = []) {
		if (this.mode === 'trigger') {
			return this._generateTriggerCSS(devices);
		}
		// Direct mode doesn't generate static CSS - values are updated live via custom properties
		return '';
	}

	_generateTriggerCSS(devices = []) {
		if (this.actionType === 'animation') {
			return this._generateAnimationCSS(devices);
		} else if (this.actionType === 'setValue') {
			return this._generateSetValueCSS(devices);
		}
		return '';
	}

	/**
	 * Generate CSS for animation actions
	 */
	_generateAnimationCSS(devices = []) {
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

		return `.${this.cssClassName} ${targetSelectors} {
  animation: ${this.animationName} ${durationSec}s ${this.easing} ${iterationsValue};
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
		// Use the device's total channel count to ensure we have enough elements
		// (e.g., RGBW needs 4 channels even if only RGB are set)
		const valuesArray = new Array(deviceType.channels).fill(0);
		for (const [channelStr, value] of Object.entries(this.channelValues)) {
			const channel = parseInt(channelStr);
			if (channel < valuesArray.length) {
				valuesArray[channel] = value;
			}
		}

		// Filter controls to only include enabled ones
		// If enabledControls is null/undefined, include all controls
		// If enabledControls is an array (even if empty), filter to only those controls
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
		const props = Object.entries(properties)
			.map(([prop, value]) => `  ${prop}: ${value};`)
			.join('\n');

		return `.${this.cssClassName} #${device.cssId} {
${props}
}`;
	}

	/**
	 * Get custom property name for direct mode
	 */
	getPropertyName() {
		if (!this.propertyName.startsWith('--')) {
			return `--${this.propertyName}`;
		}
		return this.propertyName;
	}

	/**
	 * Get CSS custom property name (for slider/knob inputs)
	 * Returns the stored cssProperty value
	 */
	getInputPropertyName() {
		return this.cssProperty;
	}

	/**
	 * Check if this input is a button/trigger type (vs slider/knob)
	 * Buttons: Stream Deck buttons, MIDI notes, Keyboard keys
	 * Sliders/Knobs: MIDI CC (control change)
	 */
	isButtonInput() {
		if (!this.inputControlId) return false;

		// Button types: button-*, note-*, key-*
		// Slider/Knob types: cc-*, control-*
		return this.inputControlId.startsWith('button-') ||
		       this.inputControlId.startsWith('note-') ||
		       this.inputControlId.startsWith('key-');
	}

	/**
	 * Get button down class name (for button inputs)
	 * Returns the stored cssClassDown value
	 */
	getButtonDownClass() {
		return this.cssClassDown;
	}

	/**
	 * Get button up class name (for button inputs)
	 * Returns the stored cssClassUp value
	 */
	getButtonUpClass() {
		return this.cssClassUp;
	}

	/**
	 * Get button on class name (for toggle button inputs)
	 * Returns the stored cssClassOn value
	 */
	getButtonOnClass() {
		return this.cssClassOn;
	}

	/**
	 * Get button off class name (for toggle button inputs)
	 * Returns the stored cssClassOff value
	 */
	getButtonOffClass() {
		return this.cssClassOff;
	}

	/**
	 * Convert input value (0-1) to property value
	 */
	mapValue(inputValue) {
		const [min, max] = this.range;
		const mapped = min + (max - min) * inputValue;

		switch (this.propertyType) {
			case 'percentage':
				return `${mapped.toFixed(1)}%`;
			case 'degrees':
				return `${mapped.toFixed(1)}deg`;
			case 'number':
				return mapped.toFixed(2);
			default:
				return mapped.toString();
		}
	}

	/**
	 * Serialize to JSON for storage
	 */
	toJSON() {
		return {
			id: this.id,
			name: this.name,
			mode: this.mode,
			inputDeviceId: this.inputDeviceId,
			inputControlId: this.inputControlId,
			inputDeviceName: this.inputDeviceName,
			color: this.color,
			buttonMode: this.buttonMode,
			triggerType: this.triggerType,
			actionType: this.actionType,
			animationName: this.animationName,
			duration: this.duration,
			easing: this.easing,
			iterations: this.iterations,
			targetDeviceIds: this.targetDeviceIds,
			setValueDeviceId: this.setValueDeviceId,
			channelValues: this.channelValues,
			enabledControls: this.enabledControls,
			propertyName: this.propertyName,
			propertyType: this.propertyType,
			range: this.range,
			cssClassName: this.cssClassName,
			cssClassDown: this.cssClassDown,
			cssClassUp: this.cssClassUp,
			cssClassOn: this.cssClassOn,
			cssClassOff: this.cssClassOff,
			cssProperty: this.cssProperty
		};
	}

	/**
	 * Deserialize from JSON
	 */
	static fromJSON(json) {
		const mapping = new InputMapping(json);

		// Fix old input mode mappings that have trigger suffixes in their class names
		// This handles legacy data where input mode had _down/_up/_always suffixes
		if (mapping.mode === 'input' && mapping.cssClassName.match(/[_-](down|up|always)$/)) {
			mapping.cssClassName = mapping._generateClassName();
		}

		// Migrate old underscore-based class names to dash-based format
		if (mapping.cssClassName) {
			mapping.cssClassName = mapping.cssClassName.replace(/_/g, '-');
		}
		if (mapping.cssClassDown) {
			mapping.cssClassDown = mapping.cssClassDown.replace(/_/g, '-');
		}
		if (mapping.cssClassUp) {
			mapping.cssClassUp = mapping.cssClassUp.replace(/_/g, '-');
		}
		if (mapping.cssClassOn) {
			mapping.cssClassOn = mapping.cssClassOn.replace(/_/g, '-');
		}
		if (mapping.cssClassOff) {
			mapping.cssClassOff = mapping.cssClassOff.replace(/_/g, '-');
		}

		return mapping;
	}
}

/**
 * Manages a library of input mappings
 */
export class MappingLibrary {
	constructor() {
		this.mappings = new Map(); // id -> InputMapping
		this.listeners = new Map(); // event -> Set of callbacks
		this.load();
	}

	/**
	 * Add event listener
	 */
	on(event, callback) {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event).add(callback);
	}

	/**
	 * Remove event listener
	 */
	off(event, callback) {
		if (this.listeners.has(event)) {
			this.listeners.get(event).delete(callback);
		}
	}

	/**
	 * Emit event
	 */
	_emit(event, data) {
		if (!this.listeners.has(event)) return;
		const callbacks = this.listeners.get(event);
		for (const callback of callbacks) {
			callback(data);
		}
	}

	/**
	 * Add a mapping
	 */
	add(mapping) {
		this.mappings.set(mapping.id, mapping);
		this.save();
		this._emit('changed', { type: 'add', mapping });
		return mapping;
	}

	/**
	 * Update a mapping
	 */
	update(mapping) {
		if (this.mappings.has(mapping.id)) {
			this.mappings.set(mapping.id, mapping);
			this.save();
			this._emit('changed', { type: 'update', mapping });
		}
	}

	/**
	 * Remove a mapping
	 */
	remove(id) {
		const mapping = this.mappings.get(id);
		this.mappings.delete(id);
		this.save();
		this._emit('changed', { type: 'remove', mapping, id });
	}

	/**
	 * Get mapping by ID
	 */
	get(id) {
		return this.mappings.get(id);
	}

	/**
	 * Get all mappings
	 */
	getAll() {
		return Array.from(this.mappings.values());
	}

	/**
	 * Get mappings for a specific input
	 */
	getByInput(deviceId, controlId) {
		return this.getAll().filter(
			m => m.inputDeviceId === deviceId && m.inputControlId === controlId
		);
	}

	/**
	 * Get trigger mappings
	 */
	getTriggerMappings() {
		return this.getAll().filter(m => m.mode === 'trigger');
	}

	/**
	 * Get direct mappings
	 */
	getDirectMappings() {
		return this.getAll().filter(m => m.mode === 'direct');
	}

	/**
	 * Generate CSS for all trigger mappings
	 */
	toCSS(devices = []) {
		return this.getTriggerMappings()
			.map(mapping => mapping.toCSS(devices))
			.filter(css => css)
			.join('\n\n');
	}

	/**
	 * Save to localStorage
	 */
	save() {
		const data = this.getAll().map(m => m.toJSON());
		localStorage.setItem('dmx-mappings', JSON.stringify(data));
	}

	/**
	 * Load from localStorage
	 */
	load() {
		const data = localStorage.getItem('dmx-mappings');
		if (data) {
			try {
				const mappings = JSON.parse(data);
				for (const mappingData of mappings) {
					const mapping = InputMapping.fromJSON(mappingData);
					this.mappings.set(mapping.id, mapping);
				}
			} catch (e) {
				console.error('Failed to load mappings:', e);
			}
		}
	}

	/**
	 * Clear all mappings
	 */
	clear() {
		this.mappings.clear();
		this.save();
	}
}

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
