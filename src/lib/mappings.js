/**
 * Mapping System
 *
 * Maps input controls to either:
 * 1. Trigger mode - Run animation when input is triggered
 * 2. Direct mode - Continuously control a CSS custom property
 */

/**
 * Represents a single input-to-output mapping
 */
export class InputMapping {
	constructor(config = {}) {
		this.id = config.id || `mapping-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		this.name = config.name || 'Untitled Mapping';
		this.mode = config.mode || 'trigger'; // 'trigger' or 'direct'

		// Input source
		this.inputDeviceId = config.inputDeviceId || null;
		this.inputControlId = config.inputControlId || null;

		// Trigger mode settings
		this.animationName = config.animationName || null;
		this.duration = config.duration || 1000; // ms
		this.easing = config.easing || 'linear';
		this.iterations = config.iterations || 1; // number or 'infinite'
		this.targetDeviceIds = config.targetDeviceIds || []; // Array of device IDs

		// Direct mode settings
		this.propertyName = config.propertyName || '--value'; // CSS custom property name
		this.propertyType = config.propertyType || 'percentage'; // 'percentage', 'degrees', 'number'
		this.range = config.range || [0, 100]; // [min, max] output range

		// CSS class name for trigger mode (auto-generated from input)
		this.cssClassName = config.cssClassName || this._generateClassName();
	}

	/**
	 * Generate CSS class name from input device/control
	 */
	_generateClassName() {
		if (!this.inputDeviceId || !this.inputControlId) {
			return `mapping-${this.id}`;
		}

		// Convert input IDs to valid CSS class names
		const devicePart = this.inputDeviceId.replace(/[^a-zA-Z0-9-]/g, '-');
		const controlPart = this.inputControlId.replace(/[^a-zA-Z0-9-]/g, '-');

		return `${devicePart}-${controlPart}`;
	}

	/**
	 * Update CSS class name when input changes
	 */
	updateClassName() {
		this.cssClassName = this._generateClassName();
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
		if (!this.animationName) return '';

		const targetSelectors = this.targetDeviceIds
			.map(id => `#device-${id}`)
			.join(', ');

		if (!targetSelectors) return '';

		const iterationsValue = this.iterations === 'infinite' ? 'infinite' : this.iterations;
		const durationSec = (this.duration / 1000).toFixed(3);

		return `.${this.cssClassName} ${targetSelectors} {
  animation: ${this.animationName} ${durationSec}s ${this.easing} ${iterationsValue};
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
			animationName: this.animationName,
			duration: this.duration,
			easing: this.easing,
			iterations: this.iterations,
			targetDeviceIds: this.targetDeviceIds,
			propertyName: this.propertyName,
			propertyType: this.propertyType,
			range: this.range,
			cssClassName: this.cssClassName
		};
	}

	/**
	 * Deserialize from JSON
	 */
	static fromJSON(json) {
		return new InputMapping(json);
	}
}

/**
 * Manages a library of input mappings
 */
export class MappingLibrary {
	constructor() {
		this.mappings = new Map(); // id -> InputMapping
		this.load();
	}

	/**
	 * Add a mapping
	 */
	add(mapping) {
		this.mappings.set(mapping.id, mapping);
		this.save();
		return mapping;
	}

	/**
	 * Remove a mapping
	 */
	remove(id) {
		this.mappings.delete(id);
		this.save();
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
		this.container = null; // Will be set to the container element
	}

	/**
	 * Set the container element
	 */
	setContainer(element) {
		this.container = element;
	}

	/**
	 * Trigger a mapping (add CSS class)
	 */
	trigger(mapping) {
		if (!this.container || mapping.mode !== 'trigger') return;

		const className = mapping.cssClassName;

		// Add the class
		this.container.classList.add(className);
		this.activeClasses.add(className);

		// If not infinite, remove after duration
		if (mapping.iterations !== 'infinite') {
			const totalDuration = mapping.duration * (mapping.iterations || 1);

			setTimeout(() => {
				this.container.classList.remove(className);
				this.activeClasses.delete(className);
			}, totalDuration);
		}
	}

	/**
	 * Release a mapping (remove CSS class) - for button releases
	 */
	release(mapping) {
		if (!this.container || mapping.mode !== 'trigger') return;

		const className = mapping.cssClassName;
		this.container.classList.remove(className);
		this.activeClasses.delete(className);
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
