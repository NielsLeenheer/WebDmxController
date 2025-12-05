/**
 * SceneLibrary - Reactive Svelte 5 library for managing scenes
 *
 * Extends Library base class with scene-specific functionality.
 * Stores scenes as plain objects (not class instances) for proper reactivity.
 *
 * Structure:
 * {
 *   id: string,
 *   name: string,
 *   cssIdentifier: string,
 *   devices: [
 *     {
 *       deviceId: string,
 *       type: 'values' | 'animation',
 *       values: { ... },           // when type='values'
 *       animation: {               // when type='animation'
 *         id: string,
 *         duration: number,
 *         easing: string,
 *         iterations: number | 'infinite'
 *       }
 *     }
 *   ],
 *   order: number
 * }
 */

import { Library } from './Library.svelte.js';
import { toCSSIdentifier, toUniqueCSSIdentifier } from './css/utils.js';
import { DEVICE_TYPES } from './outputs/devices.js';
import { getProperties } from './outputs/css.js';

const DEFAULT_SCENE_ID = 'default';
const DEFAULT_SCENE_NAME = 'Default';

export class SceneLibrary extends Library {
	constructor() {
		super('dmx-scenes');
		this._ensureDefaultScene();
	}

	/**
	 * Ensure the default scene exists
	 * @private
	 */
	_ensureDefaultScene() {
		if (!this.get(DEFAULT_SCENE_ID)) {
			// Add default scene directly without triggering save cycle
			this.items.push({
				id: DEFAULT_SCENE_ID,
				name: DEFAULT_SCENE_NAME,
				cssIdentifier: 'default',
				devices: [],
				order: -1 // Always first
			});
		}
	}

	/**
	 * Check if a scene is the default scene
	 * @param {string} sceneId - Scene ID to check
	 * @returns {boolean}
	 */
	isDefault(sceneId) {
		return sceneId === DEFAULT_SCENE_ID;
	}

	/**
	 * Get the default scene
	 * @returns {Object} Default scene object
	 */
	getDefault() {
		return this.get(DEFAULT_SCENE_ID);
	}

	/**
	 * Create and add a new scene
	 * @param {Object} config - Scene configuration
	 * @returns {Object} Created scene object
	 */
	create(config = {}) {
		const name = config.name || 'New Scene';

		// Get existing CSS identifiers for uniqueness check
		const existingIdentifiers = new Set(this.items.map(s => s.cssIdentifier));

		return this.add({
			name,
			cssIdentifier: toUniqueCSSIdentifier(name, existingIdentifiers),
			devices: [],
			order: this.items.length
		});
	}

	/**
	 * Update scene properties
	 * @param {string} sceneId - Scene ID
	 * @param {Object} updates - Properties to update
	 * @returns {boolean} Success status
	 */
	update(sceneId, updates) {
		// Prevent renaming default scene
		if (this.isDefault(sceneId) && updates.name) {
			delete updates.name;
		}

		// Update CSS ID if name changed
		if (updates.name) {
			const existingIdentifiers = new Set(this.items.map(s => s.cssIdentifier));
			const currentScene = this.get(sceneId);
			if (currentScene) {
				existingIdentifiers.delete(currentScene.cssIdentifier);
			}
			updates.cssIdentifier = toUniqueCSSIdentifier(updates.name, existingIdentifiers);
		}

		return super.update(sceneId, updates);
	}

	/**
	 * Remove a scene (cannot remove default scene)
	 * @param {string} sceneId - Scene ID to remove
	 * @returns {boolean} Success status
	 */
	remove(sceneId) {
		if (this.isDefault(sceneId)) {
			return false;
		}
		return super.remove(sceneId);
	}

	/**
	 * Add a device to a scene
	 * @param {string} sceneId - Scene ID
	 * @param {Object} deviceConfig - Device configuration
	 * @returns {string|null} Entry ID if successful, null otherwise
	 */
	addDevice(sceneId, deviceConfig) {
		const scene = this.get(sceneId);
		if (!scene) return null;

		// Generate unique entry ID
		const entryId = crypto.randomUUID();

		const deviceEntry = {
			entryId,
			deviceId: deviceConfig.deviceId,
			type: deviceConfig.type || 'values',
			values: deviceConfig.type === 'values' ? (deviceConfig.values || {}) : null,
			animation: deviceConfig.type === 'animation' ? {
				id: deviceConfig.animation?.id || null,
				duration: deviceConfig.animation?.duration || 1000,
				easing: deviceConfig.animation?.easing || 'linear',
				iterations: deviceConfig.animation?.iterations || 'infinite'
			} : null
		};

		scene.devices.push(deviceEntry);
		this.save();
		return entryId;
	}

	/**
	 * Update a device entry in a scene
	 * @param {string} sceneId - Scene ID
	 * @param {string} entryId - Entry ID (unique per device entry)
	 * @param {Object} updates - Device updates
	 * @returns {boolean} Success status
	 */
	updateDevice(sceneId, entryId, updates) {
		const scene = this.get(sceneId);
		if (!scene) return false;

		const deviceEntry = scene.devices.find(d => d.entryId === entryId);
		if (!deviceEntry) return false;

		// Update type if changed
		if (updates.type && updates.type !== deviceEntry.type) {
			deviceEntry.type = updates.type;
			// Reset values/animation when type changes
			if (updates.type === 'values') {
				deviceEntry.values = updates.values || {};
				deviceEntry.animation = null;
			} else {
				deviceEntry.values = null;
				deviceEntry.animation = updates.animation || {
					id: null,
					duration: 1000,
					easing: 'linear',
					iterations: 'infinite'
				};
			}
		} else {
			// Update values or animation based on current type
			if (deviceEntry.type === 'values' && updates.values) {
				// Deep copy values
				deviceEntry.values = {};
				for (const [key, value] of Object.entries(updates.values)) {
					if (typeof value === 'object' && value !== null) {
						deviceEntry.values[key] = { ...value };
					} else {
						deviceEntry.values[key] = value;
					}
				}
			} else if (deviceEntry.type === 'animation' && updates.animation) {
				deviceEntry.animation = {
					id: updates.animation.id || deviceEntry.animation?.id,
					duration: updates.animation.duration || deviceEntry.animation?.duration || 1000,
					easing: updates.animation.easing || deviceEntry.animation?.easing || 'linear',
					iterations: updates.animation.iterations !== undefined
						? updates.animation.iterations
						: (deviceEntry.animation?.iterations || 'infinite')
				};
			}
		}

		this.save();
		return true;
	}

	/**
	 * Remove a device entry from a scene
	 * @param {string} sceneId - Scene ID
	 * @param {string} entryId - Entry ID
	 * @returns {boolean} Success status
	 */
	removeDevice(sceneId, entryId) {
		const scene = this.get(sceneId);
		if (!scene) return false;

		const index = scene.devices.findIndex(d => d.entryId === entryId);
		if (index === -1) return false;

		scene.devices.splice(index, 1);
		this.save();
		return true;
	}

	/**
	 * Reorder device entries within a scene
	 * @param {string} sceneId - Scene ID
	 * @param {Array<string>} orderedEntryIds - Array of entry IDs in desired order
	 * @returns {boolean} Success status
	 */
	reorderDevices(sceneId, orderedEntryIds) {
		const scene = this.get(sceneId);
		if (!scene) return false;

		// Create a map of entry ID to device entry
		const entryMap = new Map(scene.devices.map(d => [d.entryId, d]));

		// Reorder based on provided order
		const reordered = orderedEntryIds
			.map(id => entryMap.get(id))
			.filter(Boolean);

		// Add any entries not in the ordered list at the end
		const orderedSet = new Set(orderedEntryIds);
		for (const entry of scene.devices) {
			if (!orderedSet.has(entry.entryId)) {
				reordered.push(entry);
			}
		}

		scene.devices = reordered;
		this.save();
		return true;
	}

	/**
	 * Get a device entry from a scene by entry ID
	 * @param {string} sceneId - Scene ID
	 * @param {string} entryId - Entry ID
	 * @returns {Object|null} Device entry or null
	 */
	getDeviceEntry(sceneId, entryId) {
		const scene = this.get(sceneId);
		if (!scene) return null;
		return scene.devices.find(d => d.entryId === entryId) || null;
	}

	/**
	 * Generate CSS for all scenes
	 * @param {Array} devices - Array of device objects from DeviceLibrary
	 * @param {Object} animationLibrary - AnimationLibrary instance
	 * @returns {string} Combined CSS
	 */
	toCSS(devices = [], animationLibrary = null) {
		const cssRules = [];

		// Get all scenes (including default - it may have devices with custom values)
		const scenes = this.getAll();

		for (const scene of scenes) {
			const sceneRules = this._generateSceneCSS(scene, devices, animationLibrary);
			if (sceneRules) {
				cssRules.push(sceneRules);
			}
		}

		return cssRules.join('\n\n');
	}

	/**
	 * Generate CSS for a single scene
	 * @private
	 */
	_generateSceneCSS(scene, devices, animationLibrary) {
		const rules = [];

		// Group device entries by deviceId to combine animations
		const deviceEntryGroups = new Map();
		for (const deviceEntry of scene.devices) {
			const key = deviceEntry.deviceId;
			if (!deviceEntryGroups.has(key)) {
				deviceEntryGroups.set(key, []);
			}
			deviceEntryGroups.get(key).push(deviceEntry);
		}

		for (const [deviceId, entries] of deviceEntryGroups) {
			const device = devices.find(d => d.id === deviceId);
			if (!device) continue;

			const deviceType = DEVICE_TYPES[device.type];
			if (!deviceType) continue;

			const selector = `[scene="${scene.cssIdentifier}"] #${device.cssIdentifier}`;

			// Separate values entries and animation entries
			const valueEntries = entries.filter(e => e.type === 'values' && e.values);
			const animationEntries = entries.filter(e => e.type === 'animation' && e.animation?.id);

			// Merge all values into one object
			const mergedValues = {};
			for (const entry of valueEntries) {
				Object.assign(mergedValues, entry.values);
			}

			// Generate CSS properties from merged values
			if (Object.keys(mergedValues).length > 0) {
				const filteredControls = deviceType.controls.filter(control =>
					Object.hasOwn(mergedValues, control.id)
				);

				const properties = getProperties(mergedValues, filteredControls);

				if (Object.keys(properties).length > 0) {
					const props = Object.entries(properties)
						.map(([prop, value]) => `  ${prop}: ${value};`)
						.join('\n');

					rules.push(`${selector} {\n${props}\n}`);
				}
			}

			// Combine all animations into a single rule
			if (animationEntries.length > 0) {
				const animationParts = animationEntries.map(entry => {
					const anim = entry.animation;
					const animation = animationLibrary?.get(anim.id);
					const animName = animation?.cssIdentifier || anim.id;
					const iterVal = anim.iterations === 'infinite' ? 'infinite' : anim.iterations;
					const durSec = (anim.duration / 1000).toFixed(3);

					return `${animName} ${durSec}s ${anim.easing} ${iterVal}`;
				});

				rules.push(`${selector} {\n  animation: ${animationParts.join(', ')};\n}`);
			}
		}

		return rules.join('\n\n');
	}

	/**
	 * Deserialize scene data from storage
	 * @param {Object} data - Serialized scene data
	 * @param {number} index - Array index for order
	 */
	deserializeItem(data, index) {
		// Deep copy devices array
		const devices = (data.devices || []).map(deviceEntry => {
			const entry = {
				entryId: deviceEntry.entryId || crypto.randomUUID(), // Generate ID for legacy entries
				deviceId: deviceEntry.deviceId,
				type: deviceEntry.type || 'values',
				values: null,
				animation: null
			};

			if (entry.type === 'values' && deviceEntry.values) {
				entry.values = {};
				for (const [key, value] of Object.entries(deviceEntry.values)) {
					if (typeof value === 'object' && value !== null) {
						entry.values[key] = { ...value };
					} else {
						entry.values[key] = value;
					}
				}
			} else if (entry.type === 'animation' && deviceEntry.animation) {
				entry.animation = {
					id: deviceEntry.animation.id || null,
					duration: deviceEntry.animation.duration || 1000,
					easing: deviceEntry.animation.easing || 'linear',
					iterations: deviceEntry.animation.iterations !== undefined
						? deviceEntry.animation.iterations
						: 'infinite'
				};
			}

			return entry;
		});

		return {
			id: data.id,
			name: data.name,
			cssIdentifier: data.cssIdentifier || toCSSIdentifier(data.name),
			devices,
			order: data.order !== undefined ? data.order : index
		};
	}

	/**
	 * Override load to ensure default scene exists after loading
	 */
	load() {
		super.load();
		this._ensureDefaultScene();
	}
}
