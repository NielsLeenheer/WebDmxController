/**
 * Animation System
 *
 * Animations store device values (channel data) that can be mapped to CSS
 * for preview and applied to devices for playback.
 */

import { getDeviceColor } from './colorUtils.js';

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

		// For moving heads, also generate transform for pan/tilt
		if (this.deviceType === 'MOVING_HEAD') {
			const pan = this.values[0] || 0;
			const tilt = this.values[1] || 0;
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
	constructor(name = 'animation', deviceType = 'RGB', keyframes = []) {
		this.name = name;
		this.deviceType = deviceType;
		this.keyframes = keyframes; // Array of Keyframe objects
	}

	/**
	 * Add a keyframe to the animation
	 */
	addKeyframe(time, values) {
		const keyframe = new Keyframe(time, this.deviceType, values);
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

		const keyframeRules = this.keyframes
			.map(kf => kf.toCSS())
			.join('\n  ');

		return `@keyframes ${this.name} {\n  ${keyframeRules}\n}`;
	}

	/**
	 * Get color for a keyframe (for visualization)
	 */
	getKeyframeColor(keyframe) {
		return getDeviceColor(this.deviceType, keyframe.values);
	}

	/**
	 * Get interpolated values at a specific time
	 */
	getValuesAtTime(time) {
		if (this.keyframes.length === 0) {
			// No keyframes - return zeros
			const numChannels = this.deviceType === 'RGB' ? 3 : 4;
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
	 * Serialize to JSON for storage
	 */
	toJSON() {
		return {
			name: this.name,
			deviceType: this.deviceType,
			keyframes: this.keyframes.map(kf => ({
				time: kf.time,
				deviceType: kf.deviceType,
				values: kf.values
			}))
		};
	}

	/**
	 * Deserialize from JSON
	 */
	static fromJSON(json) {
		const deviceType = json.deviceType || 'RGB'; // Default for backward compatibility
		const animation = new Animation(json.name, deviceType);

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
