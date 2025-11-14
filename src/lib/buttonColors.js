/**
 * Button Color Storage
 *
 * Persists button color assignments across device disconnects/reconnects
 * Similar to how Stream Deck stores button configurations
 */

const STORAGE_KEY = 'webdmx-button-colors';

/**
 * Button Color Manager
 * Stores and retrieves button color assignments per device
 */
export class ButtonColorManager {
	constructor() {
		this.colors = this._loadFromStorage();
	}

	/**
	 * Load color assignments from localStorage
	 */
	_loadFromStorage() {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				return new Map(JSON.parse(stored));
			}
		} catch (e) {
			console.warn('Failed to load button colors from storage:', e);
		}
		return new Map();
	}

	/**
	 * Save color assignments to localStorage
	 */
	_saveToStorage() {
		try {
			const data = Array.from(this.colors.entries());
			localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
		} catch (e) {
			console.error('Failed to save button colors to storage:', e);
		}
	}

	/**
	 * Get device key for storage
	 * Uses device name for persistence across reconnects
	 */
	_getDeviceKey(deviceName) {
		// Normalize device name for consistent storage
		return deviceName.toLowerCase().replace(/\s+/g, '-');
	}

	/**
	 * Get button key within a device
	 */
	_getButtonKey(deviceKey, buttonNumber) {
		return `${deviceKey}:${buttonNumber}`;
	}

	/**
	 * Get color for a button
	 * @param {string} deviceName - Device name
	 * @param {number} buttonNumber - Button/note number
	 * @returns {string|null} Color name or null if not set
	 */
	getColor(deviceName, buttonNumber) {
		const deviceKey = this._getDeviceKey(deviceName);
		const buttonKey = this._getButtonKey(deviceKey, buttonNumber);
		return this.colors.get(buttonKey) || null;
	}

	/**
	 * Set color for a button
	 * @param {string} deviceName - Device name
	 * @param {number} buttonNumber - Button/note number
	 * @param {string} color - Color name
	 */
	setColor(deviceName, buttonNumber, color) {
		const deviceKey = this._getDeviceKey(deviceName);
		const buttonKey = this._getButtonKey(deviceKey, buttonNumber);
		this.colors.set(buttonKey, color);
		this._saveToStorage();
	}

	/**
	 * Get all button colors for a device
	 * @param {string} deviceName - Device name
	 * @returns {Map<number, string>} Map of button number to color
	 */
	getDeviceColors(deviceName) {
		const deviceKey = this._getDeviceKey(deviceName);
		const prefix = `${deviceKey}:`;
		const deviceColors = new Map();

		for (const [key, color] of this.colors.entries()) {
			if (key.startsWith(prefix)) {
				const buttonNumber = parseInt(key.substring(prefix.length));
				deviceColors.set(buttonNumber, color);
			}
		}

		return deviceColors;
	}

	/**
	 * Clear all colors for a device
	 * @param {string} deviceName - Device name
	 */
	clearDevice(deviceName) {
		const deviceKey = this._getDeviceKey(deviceName);
		const prefix = `${deviceKey}:`;

		// Remove all entries for this device
		for (const key of this.colors.keys()) {
			if (key.startsWith(prefix)) {
				this.colors.delete(key);
			}
		}

		this._saveToStorage();
	}

	/**
	 * Clear all stored colors
	 */
	clearAll() {
		this.colors.clear();
		this._saveToStorage();
	}

	/**
	 * Export color data (for backup)
	 */
	export() {
		return Array.from(this.colors.entries());
	}

	/**
	 * Import color data (from backup)
	 */
	import(data) {
		this.colors = new Map(data);
		this._saveToStorage();
	}
}
