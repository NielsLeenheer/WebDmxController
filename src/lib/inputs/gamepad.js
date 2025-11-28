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
		this.connectedGamepads = new Map(); // index -> gamepad
		this.initialized = false;
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
			console.log(`Gamepad connected: ${gamepad.id} (index: ${gamepad.id})`);
			this.connectedGamepads.set(gamepad.id, gamepad);
			this._emit('connected', { gamepad });

			// Set up button listeners for this gamepad
			this._setupGamepadListeners(gamepad);
		});

		window.gameControl.on('disconnect', (gamepadIndex) => {
			console.log(`Gamepad disconnected: index ${gamepadIndex}`);
			const gamepad = this.connectedGamepads.get(gamepadIndex);
			this.connectedGamepads.delete(gamepadIndex);
			this._emit('disconnected', { gamepadIndex, gamepad });
		});

		// Check for already-connected gamepads (they may have connected before we initialized)
		const existingGamepads = window.gameControl.getGamepads();
		if (existingGamepads) {
			for (const [id, gamepad] of Object.entries(existingGamepads)) {
				if (gamepad && !this.connectedGamepads.has(gamepad.id)) {
					console.log(`Found existing gamepad: ${gamepad.id}`);
					this.connectedGamepads.set(gamepad.id, gamepad);
					this._emit('connected', { gamepad });
					this._setupGamepadListeners(gamepad);
				}
			}
		}
	}

	/**
	 * Set up button and axis listeners for a specific gamepad
	 * @param {object} gamepad - The gamecontroller.js gamepad object
	 */
	_setupGamepadListeners(gamepad) {
		const gamepadIndex = gamepad.id;
		
		// Set up button listeners (gamecontroller.js uses button0, button1, etc.)
		const buttonCount = gamepad.buttons || 17;
		for (let i = 0; i < buttonCount; i++) {
			const buttonName = `button${i}`;
			
			// Button press (before = when pressed)
			gamepad.before(buttonName, () => {
				console.log(`Gamepad ${gamepadIndex} button ${i} pressed`);
				this._emit('buttondown', {
					gamepadIndex,
					button: i,
					buttonName,
				});
			});

			// Button release (after = when released)
			gamepad.after(buttonName, () => {
				console.log(`Gamepad ${gamepadIndex} button ${i} released`);
				this._emit('buttonup', {
					gamepadIndex,
					button: i,
					buttonName,
				});
			});
		}

		// Set up axis polling
		this._setupAxisPolling(gamepad);
	}

	/**
	 * Set up axis polling for a gamepad
	 * gamecontroller.js tracks axis values in axeValues array, we poll them each frame
	 */
	_setupAxisPolling(gamepad) {
		const gamepadIndex = gamepad.id;
		const lastValues = [0, 0, 0, 0];
		
		// Use beforeCycle to check axis values each frame
		window.gameControl.on('beforeCycle', () => {
			// Check if this gamepad is still connected
			if (!this.connectedGamepads.has(gamepadIndex)) return;
			
			// axeValues is an array of [x, y] pairs for each stick
			const axeValues = gamepad.axeValues;
			if (!axeValues) return;
			
			// Process each axis
			for (let stick = 0; stick < axeValues.length; stick++) {
				const [x, y] = axeValues[stick];
				const xAxis = stick * 2;
				const yAxis = stick * 2 + 1;
				
				// X axis
				const xValue = parseFloat(x) || 0;
				if (Math.abs(xValue - lastValues[xAxis]) > 0.01) {
					lastValues[xAxis] = xValue;
					this._emit('axismove', {
						gamepadIndex,
						axis: xAxis,
						axeName: `axis${xAxis}`,
						value: xValue,
					});
				}
				
				// Y axis
				const yValue = parseFloat(y) || 0;
				if (Math.abs(yValue - lastValues[yAxis]) > 0.01) {
					lastValues[yAxis] = yValue;
					this._emit('axismove', {
						gamepadIndex,
						axis: yAxis,
						axeName: `axis${yAxis}`,
						value: yValue,
					});
				}
			}
		});
	}

	/**
	 * Get a connected gamepad by index
	 * @param {number} index - The gamepad index
	 * @returns {object|undefined} The gamepad or undefined
	 */
	getGamepad(index) {
		return this.connectedGamepads.get(index);
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
