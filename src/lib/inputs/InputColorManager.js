/**
 * InputColorManager - Manages color assignments for input devices
 * 
 * Tracks which colors are used per device and provides methods for
 * assigning and releasing colors. This is an internal helper class
 * used by InputLibrary.
 */

import { getPalette, getUnusedFromPalette } from './colors.js';

export class InputColorManager {
	// Map of deviceId -> Set of used colors
	#deviceColorUsage = new Map();
	
	// Map of deviceId -> last palette index (for cycling when all colors used)
	#deviceColorIndices = new Map();

	/**
	 * Register a color as being used by a device
	 * @param {string} deviceId - The device ID
	 * @param {string} color - The color being used
	 */
	registerColor(deviceId, color) {
		if (!deviceId || !color) return;

		if (!this.#deviceColorUsage.has(deviceId)) {
			this.#deviceColorUsage.set(deviceId, new Set());
		}
		this.#deviceColorUsage.get(deviceId).add(color);
	}

	/**
	 * Release a color from a device (when input is deleted or color changed)
	 * @param {string} deviceId - The device ID
	 * @param {string} color - The color being released
	 */
	releaseColor(deviceId, color) {
		if (!deviceId || !color) return;

		const usage = this.#deviceColorUsage.get(deviceId);
		if (!usage) return;
		
		usage.delete(color);
		
		if (usage.size === 0) {
			this.#deviceColorUsage.delete(deviceId);
			this.#deviceColorIndices.delete(deviceId);
		}
	}

	/**
	 * Get the next available color for a device
	 * @param {string} deviceId - The device ID
	 * @param {string} colorSupport - Color support type: 'rgb', 'red', 'green', 'none'
	 * @returns {string|null} The assigned color name, or null if no color support
	 */
	getNextColor(deviceId, colorSupport = 'rgb') {
		// Handle fixed colors for single-color buttons
		if (colorSupport === 'red') return 'red';
		if (colorSupport === 'green') return 'green';
		if (colorSupport === 'none' || !colorSupport) return null;

		// For RGB buttons, try to find an unused color
		const usedColors = this.#deviceColorUsage.get(deviceId);
		const usedColorsArray = usedColors ? Array.from(usedColors) : [];

		console.log('[InputColorManager] getNextColor for device:', deviceId);
		console.log('[InputColorManager] Used colors:', usedColorsArray);

		// Try to get an unused color from the palette
		const unusedColor = getUnusedFromPalette(usedColorsArray);
		console.log('[InputColorManager] Next unused color:', unusedColor);
		if (unusedColor) {
			return unusedColor;
		}

		// All colors are used, cycle through the palette
		const palette = getPalette();
		if (!palette.length) return null;

		const lastIndex = this.#deviceColorIndices.get(deviceId) ?? -1;
		const nextIndex = (lastIndex + 1) % palette.length;
		this.#deviceColorIndices.set(deviceId, nextIndex);
		
		return palette[nextIndex];
	}

	/**
	 * Get used colors for a device
	 * @param {string} deviceId - The device ID
	 * @returns {string[]} Array of used color names
	 */
	getUsedColors(deviceId) {
		const usage = this.#deviceColorUsage.get(deviceId);
		return usage ? Array.from(usage) : [];
	}

	/**
	 * Debug method to get all used colors per device
	 * @returns {Object} Map of deviceId -> array of colors
	 */
	getUsedColorsDebug() {
		const result = {};
		for (const [deviceId, colors] of this.#deviceColorUsage) {
			result[deviceId] = Array.from(colors);
		}
		return result;
	}

	/**
	 * Clear all color tracking data
	 */
	clear() {
		this.#deviceColorUsage.clear();
		this.#deviceColorIndices.clear();
	}

	/**
	 * Rebuild color usage from a list of inputs
	 * @param {Array} inputs - Array of input objects
	 */
	rebuildFromInputs(inputs) {
		this.clear();
		
		for (const input of inputs) {
			if (input.color && input.deviceId) {
				this.registerColor(input.deviceId, input.color);
			}
		}
	}
}
