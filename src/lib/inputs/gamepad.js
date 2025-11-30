/**
 * Gamepad Manager
 *
 * Uses gamecontroller.js to provide event-based gamepad input.
 * Handles polling internally and exposes clean connect/disconnect/button/axis events.
 */

// Import gamecontroller.js - it attaches to window.gameControl
import 'gamecontroller.js';

/**
 * Standard gamepad button names (matches gamecontroller.js)
 */
export const GAMEPAD_BUTTONS = [
	'button0',  // A / Cross
	'button1',  // B / Circle
	'button2',  // X / Square
	'button3',  // Y / Triangle
	'button4',  // L1 / LB
	'button5',  // R1 / RB
	'button6',  // L2 / LT (also has analog)
	'button7',  // R2 / RT (also has analog)
	'button8',  // Select / Share
	'button9',  // Start / Options
	'button10', // L3 (left stick press)
	'button11', // R3 (right stick press)
	'button12', // D-pad Up
	'button13', // D-pad Down
	'button14', // D-pad Left
	'button15', // D-pad Right
	'button16', // Home / PS / Xbox
];

/**
 * Standard gamepad axes (as exposed by gamecontroller.js)
 */
export const GAMEPAD_AXES = [
	'axis0',   // Left stick X (-1 to 1)
	'axis1',   // Left stick Y (-1 to 1)
	'axis2',   // Right stick X (-1 to 1)
	'axis3',   // Right stick Y (-1 to 1)
];

/**
 * Gamepad Manager
 * Wraps gamecontroller.js and emits events for gamepad connections and inputs
 */
export class GamepadManager {
	constructor() {
		this.listeners = new Map();
		this.connectedGamepads = new Map(); // stableId -> gamepad
		this.indexToStableId = new Map(); // gamepad index -> stableId mapping
		this.axisLastValues = new Map(); // stableId -> array of last axis values
		this.initialized = false;
		this.axisPollingActive = false;
	}

	/**
	 * Generate a stable ID for a gamepad based on its characteristics
	 * @param {object} gamepad - The gamecontroller.js gamepad object
	 * @returns {string} Stable identifier
	 */
	_generateGamepadId(gamepad) {
		// Get the native gamepad from the browser's API
		// gamecontroller.js wraps it, but at connect time it might not be available yet
		const nativeGamepads = navigator.getGamepads ? navigator.getGamepads() : [];
		const nativeGamepad = nativeGamepads[gamepad.id];

		if (!nativeGamepad || !nativeGamepad.id) {
			// Fallback to index if native gamepad not available
			console.warn(`Native gamepad not available for index ${gamepad.id}, using index-based ID`);
			return `gamepad-${gamepad.id}`;
		}

		// The native gamepad.id usually contains manufacturer info and may include a unique identifier
		// Format is typically: "Vendor Name Product Name (Vendor: XXXX Product: YYYY)"
		const hardwareId = nativeGamepad.id || '';

		// Create a hash of the hardware ID to use as a stable identifier
		// This ensures same hardware = same ID regardless of connection order
		const hash = this._simpleHash(hardwareId);

		return `gamepad-${hash}`;
	}

	/**
	 * Simple hash function for strings
	 * @param {string} str - String to hash
	 * @returns {string} Hex hash
	 */
	_simpleHash(str) {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32bit integer
		}
		return Math.abs(hash).toString(16);
	}

	/**
	 * Initialize gamepad listening
	 */
	init() {
		if (this.initialized) return;
		
		// Check if gameControl is available
		if (!window.gameControl) {
			console.warn('gamecontroller.js not available');
			return;
		}
		
		this.initialized = true;

		// Set up gamecontroller.js event handlers
		window.gameControl.on('connect', (gamepad) => {
			// Generate a stable identifier for this gamepad
			// Use the gamepad's name + index as a unique key
			const stableId = this._generateGamepadId(gamepad);

			// Get native gamepad for logging
			const nativeGamepads = navigator.getGamepads ? navigator.getGamepads() : [];
			const nativeGamepad = nativeGamepads[gamepad.id];

			console.log(`Gamepad connected: ${gamepad.id} (stable ID: ${stableId})`);
			console.log('Gamepad details:', {
				index: gamepad.id,
				name: nativeGamepad?.id,
				mapping: nativeGamepad?.mapping,
				axes: nativeGamepad?.axes?.length,
				buttons: nativeGamepad?.buttons?.length,
				timestamp: nativeGamepad?.timestamp
			});

			this.connectedGamepads.set(stableId, gamepad);
			this.indexToStableId.set(gamepad.id, stableId);

			this._emit('connected', {
				gamepad,
				gamepadId: stableId,
				index: gamepad.id
			});

			// Set up button listeners for this gamepad
			this._setupGamepadListeners(gamepad, stableId);
		});

		window.gameControl.on('disconnect', (gamepadIndex) => {
			console.log(`Gamepad disconnected: index ${gamepadIndex}`);

			// Look up the stable ID for this index
			const stableId = this.indexToStableId.get(gamepadIndex);
			const gamepad = stableId ? this.connectedGamepads.get(stableId) : null;

			if (stableId) {
				this.connectedGamepads.delete(stableId);
				this.indexToStableId.delete(gamepadIndex);
				this.axisLastValues.delete(stableId);
			}

			this._emit('disconnected', {
				gamepadIndex,
				gamepadId: stableId,
				gamepad
			});
		});

		// Check for already-connected gamepads (they may have connected before we initialized)
		const existingGamepads = window.gameControl.getGamepads();
		if (existingGamepads) {
			for (const [id, gamepad] of Object.entries(existingGamepads)) {
				if (gamepad) {
					const stableId = this._generateGamepadId(gamepad);

					if (!this.connectedGamepads.has(stableId)) {
						console.log(`Found existing gamepad: ${gamepad.id} (stable ID: ${stableId})`);
						this.connectedGamepads.set(stableId, gamepad);
						this.indexToStableId.set(gamepad.id, stableId);
						this._emit('connected', {
							gamepad,
							gamepadId: stableId,
							index: gamepad.id
						});
						this._setupGamepadListeners(gamepad, stableId);
					}
				}
			}
		}
	}

	/**
	 * Set up button and axis listeners for a specific gamepad
	 * @param {object} gamepad - The gamecontroller.js gamepad object
	 * @param {string} stableId - The stable gamepad ID
	 */
	_setupGamepadListeners(gamepad, stableId) {
		const gamepadIndex = gamepad.id;

		// Set up button listeners (gamecontroller.js uses button0, button1, etc.)
		const buttonCount = gamepad.buttons || 17;
		for (let i = 0; i < buttonCount; i++) {
			const buttonName = `button${i}`;

			// Button press (before = when pressed)
			gamepad.before(buttonName, () => {
				console.log(`Gamepad ${stableId} (index ${gamepadIndex}) button ${i} pressed`);
				this._emit('buttondown', {
					gamepadId: stableId,
					gamepadIndex,
					button: i,
					buttonName,
				});
			});

			// Button release (after = when released)
			gamepad.after(buttonName, () => {
				console.log(`Gamepad ${stableId} (index ${gamepadIndex}) button ${i} released`);
				this._emit('buttonup', {
					gamepadId: stableId,
					gamepadIndex,
					button: i,
					buttonName,
				});
			});
		}

		// Initialize axis tracking for this gamepad
		this.axisLastValues.set(stableId, new Array(10).fill(0));

		// Start the unified axis polling if not already active
		this._startAxisPolling();
	}

	/**
	 * Start unified axis polling for all gamepads
	 * Uses a single beforeCycle listener that polls all connected gamepads
	 */
	_startAxisPolling() {
		if (this.axisPollingActive) return;
		this.axisPollingActive = true;

		// Single listener that polls ALL connected gamepads
		window.gameControl.on('beforeCycle', () => {
			// Get all native gamepads
			const nativeGamepads = navigator.getGamepads ? navigator.getGamepads() : [];

			// Iterate over all connected gamepads using our tracking
			for (const [stableId, gamepad] of this.connectedGamepads.entries()) {
				const gamepadIndex = gamepad.id;
				const nativeGamepad = nativeGamepads[gamepadIndex];

				if (!nativeGamepad) continue;

				const axes = nativeGamepad.axes;
				if (!axes || axes.length === 0) continue;

				const lastValues = this.axisLastValues.get(stableId);
				if (!lastValues) continue;

				// Process ALL axes for this gamepad
				for (let axisIndex = 0; axisIndex < axes.length; axisIndex++) {
					const axisValue = parseFloat(axes[axisIndex]) || 0;

					// Only emit if value changed significantly
					if (Math.abs(axisValue - lastValues[axisIndex]) > 0.01) {
						lastValues[axisIndex] = axisValue;
						this._emit('axismove', {
							gamepadId: stableId,
							gamepadIndex,
							axis: axisIndex,
							axeName: `axis${axisIndex}`,
							value: axisValue,
						});
					}
				}
			}
		});
	}

	/**
	 * Get a connected gamepad by stable ID
	 * @param {string} stableId - The stable gamepad ID
	 * @returns {object|undefined} The gamepad or undefined
	 */
	getGamepad(stableId) {
		return this.connectedGamepads.get(stableId);
	}

	/**
	 * Get a connected gamepad by index (legacy support)
	 * @param {number} index - The gamepad index
	 * @returns {object|undefined} The gamepad or undefined
	 */
	getGamepadByIndex(index) {
		const stableId = this.indexToStableId.get(index);
		return stableId ? this.connectedGamepads.get(stableId) : undefined;
	}

	/**
	 * Get all connected gamepads
	 * @returns {Array} Array of connected gamepads
	 */
	getConnectedGamepads() {
		return Array.from(this.connectedGamepads.values());
	}

	/**
	 * Register an event listener
	 * @param {string} event - Event name: 'connected', 'disconnected', 'buttondown', 'buttonup', 'axismove'
	 * @param {Function} callback - Callback function
	 */
	on(event, callback) {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, []);
		}
		this.listeners.get(event).push(callback);
	}

	/**
	 * Remove an event listener
	 * @param {string} event - Event name
	 * @param {Function} callback - Callback to remove
	 */
	off(event, callback) {
		if (!this.listeners.has(event)) return;
		const callbacks = this.listeners.get(event);
		const index = callbacks.indexOf(callback);
		if (index !== -1) {
			callbacks.splice(index, 1);
		}
	}

	/**
	 * Emit an event
	 * @param {string} event - Event name
	 * @param {object} data - Event data
	 */
	_emit(event, data) {
		if (!this.listeners.has(event)) return;
		for (const callback of this.listeners.get(event)) {
			try {
				callback(data);
			} catch (error) {
				console.error(`Error in gamepad ${event} handler:`, error);
			}
		}
	}
}
