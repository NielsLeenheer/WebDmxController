/**
 * Animation System
 *
 * Animations are DOM-based and device-agnostic. They define CSS keyframes
 * that are applied to device elements. The sampling system extracts values
 * based on what each device supports.
 */

/**
 * Represents a single keyframe in an animation
 */
class Keyframe {
	constructor(time = 0, properties = {}) {
		this.time = time; // 0-1 normalized time
		this.properties = properties; // CSS properties: { color: 'rgb(255,0,0)', opacity: 0.5, etc }
	}

	/**
	 * Convert keyframe properties to CSS string
	 */
	toCSS() {
		const props = Object.entries(this.properties)
			.map(([prop, value]) => `${prop}: ${value}`)
			.join('; ');
		return `${this.time * 100}% { ${props}; }`;
	}
}

/**
 * Reusable animation definition (like CSS @keyframes)
 */
export class Animation {
	constructor(name = 'animation', keyframes = []) {
		this.name = name;
		this.keyframes = keyframes; // Array of Keyframe objects
	}

	/**
	 * Add a keyframe to the animation
	 */
	addKeyframe(time, properties) {
		const keyframe = new Keyframe(time, properties);
		this.keyframes.push(keyframe);
		this.keyframes.sort((a, b) => a.time - b.time);
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
	 * Create Animation from CSS @keyframes string
	 */
	static fromCSS(name, cssText) {
		const animation = new Animation(name);

		// Parse keyframe rules (simplified parser)
		// Matches: 0% { prop: value; } or from/to
		const keyframeRegex = /(from|to|\d+%)\s*\{([^}]+)\}/g;
		let match;

		while ((match = keyframeRegex.exec(cssText)) !== null) {
			const timeStr = match[1];
			const propsStr = match[2];

			// Convert from/to to percentages
			let time;
			if (timeStr === 'from') time = 0;
			else if (timeStr === 'to') time = 1;
			else time = parseFloat(timeStr) / 100;

			// Parse properties
			const properties = {};
			const propPairs = propsStr.split(';').map(s => s.trim()).filter(s => s);

			for (const pair of propPairs) {
				const colonIndex = pair.indexOf(':');
				if (colonIndex === -1) continue;

				const prop = pair.substring(0, colonIndex).trim();
				const value = pair.substring(colonIndex + 1).trim();
				properties[prop] = value;
			}

			animation.addKeyframe(time, properties);
		}

		return animation;
	}

	/**
	 * Serialize to JSON for storage
	 */
	toJSON() {
		return {
			name: this.name,
			keyframes: this.keyframes.map(kf => ({
				time: kf.time,
				properties: kf.properties
			}))
		};
	}

	/**
	 * Deserialize from JSON
	 */
	static fromJSON(json) {
		const animation = new Animation(json.name);
		for (const kf of json.keyframes) {
			animation.addKeyframe(kf.time, kf.properties);
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
		this.load();
	}

	/**
	 * Add an animation to the library
	 */
	add(animation) {
		this.animations.set(animation.name, animation);
		this.save();
	}

	/**
	 * Remove an animation
	 */
	remove(name) {
		this.animations.delete(name);
		this.save();
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
