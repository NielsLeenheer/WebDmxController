/**
 * Animation System
 *
 * Animations store device values (channel data) that can be mapped to CSS
 * for preview and applied to devices for playback.
 */

import { getDeviceColor } from './colorUtils.js';
import { DEVICE_TYPES } from './outputs/devices.js';
import { CONTROL_CSS_MAPPING, generateCSSProperties } from './css/controlCssMapping.js';
import { toCSSIdentifier } from './css/cssUtils.js';

/**
 * Represents a single keyframe in an animation
 */
class Keyframe {
	constructor(time = 0, deviceType = 'RGB', values = [0, 0, 0]) {
		this.time = time; // 0-1 normalized time
		this.deviceType = deviceType; // Device type (RGB, RGBA, RGBW, etc.)
		this.values = [...values]; // Channel values (0-255)
	}

	/**
	 * Convert keyframe values to CSS properties
	 */
	getProperties() {
		const color = getDeviceColor(this.deviceType, this.values);

		// Check if device has Pan/Tilt control (xypad) to generate transform
		const deviceTypeDef = DEVICE_TYPES[this.deviceType];
		const xypadControl = deviceTypeDef?.controls?.find(c => c.type === 'xypad');
		
		if (xypadControl) {
			// Extract pan (x) and tilt (y) from the xypad control components
			const panChannel = deviceTypeDef.components[xypadControl.components.x].channel;
			const tiltChannel = deviceTypeDef.components[xypadControl.components.y].channel;
			const pan = this.values[panChannel] || 0;
			const tilt = this.values[tiltChannel] || 0;
			
			// Convert 0-255 to percentage (-50% to 50%)
			const panPercent = ((pan / 255) * 100) - 50;
			const tiltPercent = ((tilt / 255) * 100) - 50;

			return {
				color,
				transform: `translate(${panPercent}%, ${tiltPercent}%)`
			};
		}

		return { color };
	}

	/**
	 * Convert keyframe to CSS string
	 */
	toCSS() {
		const properties = this.getProperties();
		const props = Object.entries(properties)
			.map(([prop, value]) => `${prop}: ${value}`)
			.join('; ');
		const percent = Math.round(this.time * 100);
		return `${percent}% { ${props}; }`;
	}
}

/**
 * Reusable animation definition (like CSS @keyframes)
 */
export class Animation {
	constructor(name = 'animation', deviceType = 'RGB', keyframes = [], cssName = null, controls = null, displayName = null) {
		this.name = name;
		// NOTE: deviceType parameter kept for backwards compatibility but not stored
		// Animations are control-based, not device-based
		this.controls = controls || []; // Array of control names to animate
		this.displayName = displayName; // Display name for UI (e.g., "Color" or "RGBW Light")
		this.keyframes = keyframes; // Array of Keyframe objects
		// Stored CSS animation name (generated from name and stored)
		this.cssName = cssName || toCSSIdentifier(this.name);
	}

	/**
	 * Get controls and components arrays for rendering
	 * Returns {controls: [], components: []} needed by the Controls component
	 */
	getControlsForRendering() {
		if (!this.controls || this.controls.length === 0) {
			// Fallback: use RGB device controls
			return {
				controls: DEVICE_TYPES.RGB.controls,
				components: DEVICE_TYPES.RGB.components
			};
		}

		// Find a device type that has all the required controls
		for (const [deviceKey, deviceDef] of Object.entries(DEVICE_TYPES)) {
			const hasAllControls = this.controls.every(controlName =>
				deviceDef.controls.some(c => c.name === controlName)
			);
			if (hasAllControls) {
				// Filter to only the controls we want
				const filteredControls = deviceDef.controls.filter(c =>
					this.controls.includes(c.name)
				);
				return {
					controls: filteredControls,
					components: deviceDef.components
				};
			}
		}

		// Fallback to RGB if no device type matches
		return {
			controls: DEVICE_TYPES.RGB.controls,
			components: DEVICE_TYPES.RGB.components
		};
	}

	/**
	 * Update stored CSS name when animation name changes
	 */
	updateCSSName() {
		this.cssName = toCSSIdentifier(this.name);
	}

	/**
	 * Add a keyframe to the animation
	 */
	addKeyframe(time, values) {
		// Find a device type for rendering the keyframe
		const { controls, components } = this.getControlsForRendering();
		// Use first matching device type (this is just for keyframe rendering)
		let deviceType = 'RGB';
		for (const [key, def] of Object.entries(DEVICE_TYPES)) {
			if (def.controls === controls && def.components === components) {
				deviceType = key;
				break;
			}
		}
		const keyframe = new Keyframe(time, deviceType, values);
		this.keyframes = [...this.keyframes, keyframe].sort((a, b) => a.time - b.time);
		return keyframe;
	}

	/**
	 * Remove a keyframe
	 */
	removeKeyframe(keyframe) {
		const index = this.keyframes.indexOf(keyframe);
		if (index !== -1) {
			this.keyframes.splice(index, 1);
		}
	}

	/**
	 * Convert animation to CSS @keyframes rule
	 */
	toCSS() {
		if (this.keyframes.length === 0) {
			return '';
		}

		// Generate CSS based on controls being animated
		const keyframeRules = this.keyframes.map(kf => {
			const percent = Math.round(kf.time * 100);
			const properties = this._getKeyframeProperties(kf);
			const props = Object.entries(properties)
				.map(([prop, value]) => `${prop}: ${value}`)
				.join('; ');
			return `${percent}% { ${props}; }`;
		}).join('\n  ');

		return `@keyframes ${this.cssName} {\n  ${keyframeRules}\n}`;
	}

	/**
	 * Get CSS properties for a keyframe based on animated controls
	 */
	_getKeyframeProperties(keyframe) {
		const { controls, components } = this.getControlsForRendering();

		// Use shared mapping function
		const properties = generateCSSProperties(controls, components, keyframe.values, keyframe.deviceType);

		// Fallback: if no properties generated, use color
		if (Object.keys(properties).length === 0) {
			properties.color = getDeviceColor(keyframe.deviceType, keyframe.values);
		}

		return properties;
	}

	/**
	 * Get color for a keyframe (for visualization)
	 */
	getKeyframeColor(keyframe) {
		// Use the keyframe's own deviceType (keyframes store deviceType for rendering)
		return getDeviceColor(keyframe.deviceType, keyframe.values);
	}

	/**
	 * Get interpolated values at a specific time
	 */
	getValuesAtTime(time) {
		if (this.keyframes.length === 0) {
			// No keyframes - return zeros based on controls
			const { components } = this.getControlsForRendering();
			const numChannels = components.length;
			return new Array(numChannels).fill(0);
		}

		const sortedKeyframes = [...this.keyframes].sort((a, b) => a.time - b.time);

		// Before first keyframe - use first keyframe values
		if (time <= sortedKeyframes[0].time) {
			return [...sortedKeyframes[0].values];
		}

		// After last keyframe - use last keyframe values
		if (time >= sortedKeyframes[sortedKeyframes.length - 1].time) {
			return [...sortedKeyframes[sortedKeyframes.length - 1].values];
		}

		// Find surrounding keyframes
		for (let i = 0; i < sortedKeyframes.length - 1; i++) {
			const kf1 = sortedKeyframes[i];
			const kf2 = sortedKeyframes[i + 1];

			if (time >= kf1.time && time <= kf2.time) {
				// Interpolate between kf1 and kf2
				const t = (time - kf1.time) / (kf2.time - kf1.time);
				const values = [];
				for (let j = 0; j < kf1.values.length; j++) {
					const v1 = kf1.values[j];
					const v2 = kf2.values[j];
					values.push(Math.round(v1 + (v2 - v1) * t));
				}
				return values;
			}
		}

		// Fallback - shouldn't reach here
		return [...sortedKeyframes[0].values];
	}

	/**
	 * Get gradient segments for timeline visualization
	 */
	getGradientSegments(timelineWidth = 1000) {
		if (this.keyframes.length === 0) {
			return [{
				left: 0,
				width: timelineWidth,
				gradient: '#000000'
			}];
		}

		const segments = [];
		const sortedKeyframes = [...this.keyframes].sort((a, b) => a.time - b.time);

		// Segment from start (0%) to first keyframe
		if (sortedKeyframes[0].time > 0) {
			const firstColor = this.getKeyframeColor(sortedKeyframes[0]);
			segments.push({
				left: 0,
				width: sortedKeyframes[0].time * timelineWidth,
				gradient: `linear-gradient(to right, #000000, ${firstColor})`
			});
		}

		// Segments between keyframes
		for (let i = 0; i < sortedKeyframes.length - 1; i++) {
			const kf1 = sortedKeyframes[i];
			const kf2 = sortedKeyframes[i + 1];
			const color1 = this.getKeyframeColor(kf1);
			const color2 = this.getKeyframeColor(kf2);

			segments.push({
				left: kf1.time * timelineWidth,
				width: (kf2.time - kf1.time) * timelineWidth,
				gradient: `linear-gradient(to right, ${color1}, ${color2})`
			});
		}

		// Segment from last keyframe to end (100%)
		const lastKeyframe = sortedKeyframes[sortedKeyframes.length - 1];
		if (lastKeyframe.time < 1) {
			const lastColor = this.getKeyframeColor(lastKeyframe);
			segments.push({
				left: lastKeyframe.time * timelineWidth,
				width: (1 - lastKeyframe.time) * timelineWidth,
				gradient: `linear-gradient(to right, ${lastColor}, #000000)`
			});
		}

		return segments;
	}

	/**
	 * Get channels that this animation affects
	 * Returns array of channel indices
	 */
	getAffectedChannels() {
		const { controls, components } = this.getControlsForRendering();

		if (!this.controls || this.controls.length === 0) {
			// Animate all channels
			return Array.from({ length: components.length }, (_, i) => i);
		}

		// Animate only channels for the specified controls
		const channels = new Set(); // Use Set to avoid duplicates
		for (const control of controls) {
			for (const componentIndex of Object.values(control.components)) {
				const channel = components[componentIndex].channel;
				channels.add(channel);
			}
		}

		return Array.from(channels).sort((a, b) => a - b);
	}

	/**
	 * Get number of channels that this animation uses
	 */
	getNumChannels() {
		return this.getAffectedChannels().length;
	}

	/**
	 * Get display name for this animation
	 * Uses stored displayName or falls back to controls list
	 */
	getDisplayName() {
		if (this.displayName) {
			return this.displayName;
		}
		// Fallback: join control names
		if (this.controls && this.controls.length > 0) {
			return this.controls.join(', ');
		}
		return 'Animation';
	}

	/**
	 * Get control names for display badges
	 */
	getControlNames() {
		return this.controls || [];
	}

	/**
	 * Serialize to JSON for storage
	 */
	toJSON() {
		return {
			name: this.name,
			// NOTE: Not storing deviceType - animations are control-based
			controls: this.controls,
			displayName: this.displayName,
			keyframes: this.keyframes.map(kf => ({
				time: kf.time,
				deviceType: kf.deviceType,  // Keyframes still store deviceType for rendering
				values: kf.values
			}))
		};
	}

	/**
	 * Deserialize from JSON
	 */
	static fromJSON(json) {
		// Handle backward compatibility: controlName (singular) → controls (array)
		let controls = json.controls || null;
		if (!controls && json.controlName) {
			controls = [json.controlName];
		}

		// Backward compatibility: if no controls, derive from old deviceType
		if (!controls && json.deviceType) {
			const deviceDef = DEVICE_TYPES[json.deviceType];
			if (deviceDef) {
				controls = deviceDef.controls.map(c => c.name);
			}
		}

		// Final fallback
		if (!controls || controls.length === 0) {
			controls = ['Color'];
		}

		const displayName = json.displayName || null;

		// Pass deviceType for constructor but it won't be stored
		const animation = new Animation(json.name, 'RGB', [], null, controls, displayName);

		for (const kf of json.keyframes) {
			// Handle old format (properties) and new format (values)
			if (kf.values) {
				animation.addKeyframe(kf.time, kf.values);
			} else if (kf.properties) {
				// Legacy format - try to extract RGB from color property
				const defaultValues = new Array(animation.deviceType === 'RGB' ? 3 : 4).fill(0);
				animation.addKeyframe(kf.time, defaultValues);
			}
		}
		return animation;
	}
}

/**
 * Manages a library of reusable animations
 */
export class AnimationLibrary {
	constructor() {
		this.animations = new Map(); // name -> Animation
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
	 * Add an animation to the library
	 */
	add(animation) {
		this.animations.set(animation.name, animation);
		this.save();
		this._emit('changed', { type: 'add', animation });
	}

	/**
	 * Remove an animation
	 */
	remove(name) {
		const animation = this.animations.get(name);
		this.animations.delete(name);
		this.save();
		this._emit('changed', { type: 'remove', animation, name });
	}

	/**
	 * Get animation by name
	 */
	get(name) {
		return this.animations.get(name);
	}

	/**
	 * Get all animations
	 */
	getAll() {
		return Array.from(this.animations.values());
	}

	/**
	 * Check if animation exists
	 */
	has(name) {
		return this.animations.has(name);
	}

	/**
	 * Rename an animation
	 */
	rename(oldName, newName) {
		const animation = this.animations.get(oldName);
		if (!animation) return false;

		animation.name = newName;
		this.animations.delete(oldName);
		this.animations.set(newName, animation);
		this.save();
		return true;
	}

	/**
	 * Generate CSS for all animations
	 */
	toCSS() {
		return this.getAll()
			.map(anim => anim.toCSS())
			.filter(css => css)
			.join('\n\n');
	}

	/**
	 * Save to localStorage
	 */
	save() {
		const data = this.getAll().map(anim => anim.toJSON());
		localStorage.setItem('dmx-animations', JSON.stringify(data));
	}

	/**
	 * Load from localStorage
	 */
	load() {
		const data = localStorage.getItem('dmx-animations');
		if (data) {
			try {
				const animations = JSON.parse(data);
				for (const animData of animations) {
					const animation = Animation.fromJSON(animData);
					this.animations.set(animation.name, animation);
				}
			} catch (e) {
				console.error('Failed to load animations:', e);
			}
		}
	}

	/**
	 * Clear all animations
	 */
	clear() {
		this.animations.clear();
		this.save();
	}
}
