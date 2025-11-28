import { InputDevice } from './InputDevice.js';
import { GAMEPAD_BUTTONS, GAMEPAD_AXES } from '../gamepad.js';

/**
 * Gamepad brand detection patterns
 * Used to determine button naming scheme
 */
const GAMEPAD_BRANDS = {
	sony: [
		/dualshock/i,
		/dualsense/i,
		/playstation/i,
		/sony/i,
		/ps[3-5]/i,
		/054c/i, // Sony vendor ID
	],
	nintendo: [
		/nintendo/i,
		/switch/i,
		/pro\s*controller/i,
		/joy-?con/i,
		/057e/i, // Nintendo vendor ID
	],
	// Xbox and others use default naming
};

/**
 * Detect gamepad brand from raw ID string
 * @param {string} rawId - The raw gamepad ID from the browser
 * @returns {'sony'|'nintendo'|'xbox'} The detected brand
 */
function detectGamepadBrand(rawId) {
	if (!rawId) return 'xbox';
	
	for (const [brand, patterns] of Object.entries(GAMEPAD_BRANDS)) {
		for (const pattern of patterns) {
			if (pattern.test(rawId)) {
				return brand;
			}
		}
	}
	
	return 'xbox'; // Default to Xbox-style naming
}

/**
 * Face button names by brand (indices 0-3)
 * Clockwise from top: 12 o'clock, 3 o'clock, 6 o'clock, 9 o'clock
 * Standard gamepad mapping: 0=bottom, 1=right, 2=left, 3=top
 */
const FACE_BUTTON_NAMES = {
	// Sony: Cross (bottom), Circle (right), Square (left), Triangle (top)
	sony: {
		0: 'Cross',
		1: 'Circle',
		2: 'Square',
		3: 'Triangle',
	},
	// Nintendo: B (bottom), A (right), Y (left), X (top)
	nintendo: {
		0: 'B',
		1: 'A',
		2: 'Y',
		3: 'X',
	},
	// Xbox/Default: A (bottom), B (right), X (left), Y (top)
	xbox: {
		0: 'A',
		1: 'B',
		2: 'X',
		3: 'Y',
	},
};

/**
 * Known gamepad name mappings for friendlier display
 * Maps patterns to short names
 */
const KNOWN_GAMEPADS = [
	{ pattern: /dualshock\s*4/i, name: 'DualShock 4' },
	{ pattern: /dualsense/i, name: 'DualSense' },
	{ pattern: /xbox\s*(one|series|360)/i, name: (match) => `Xbox ${match[1]}` },
	{ pattern: /xbox.*controller/i, name: 'Xbox Controller' },
	{ pattern: /8bitdo/i, name: (match, full) => {
		// Try to extract model like "SN30", "Pro 2", etc.
		const model = full.match(/8bitdo\s+(\S+)/i);
		return model ? `8BitDo ${model[1]}` : '8BitDo Controller';
	}},
	{ pattern: /pro\s*controller/i, name: 'Pro Controller' }, // Nintendo Switch
	{ pattern: /joy-?con/i, name: 'Joy-Con' },
	{ pattern: /stadia/i, name: 'Stadia Controller' },
	{ pattern: /luna/i, name: 'Luna Controller' },
];

/**
 * Extract a friendly name from the verbose browser gamepad ID
 * @param {string} rawId - The raw gamepad ID from the browser
 * @returns {string} A friendlier display name
 */
function getFriendlyGamepadName(rawId) {
	if (!rawId) return 'Gamepad';
	
	// Check known gamepad patterns
	for (const { pattern, name } of KNOWN_GAMEPADS) {
		const match = rawId.match(pattern);
		if (match) {
			return typeof name === 'function' ? name(match, rawId) : name;
		}
	}
	
	// Generic cleanup: remove vendor/product info in parentheses
	// "Controller Name (STANDARD GAMEPAD Vendor: xxxx Product: xxxx)" -> "Controller Name"
	let cleaned = rawId.replace(/\s*\(.*?(vendor|product|standard\s*gamepad).*?\)\s*/gi, '').trim();
	
	// If still too long or empty, try to get just the first part
	if (!cleaned || cleaned.length > 30) {
		// Try to extract meaningful name before any parentheses or technical info
		const firstPart = rawId.match(/^([^(]+)/);
		if (firstPart) {
			cleaned = firstPart[1].trim();
		}
	}
	
	// Final fallback
	return cleaned || 'Gamepad';
}

/**
 * Common button names (non-face buttons)
 */
const COMMON_BUTTON_NAMES = {
	4: 'L1',
	5: 'R1',
	6: 'L2',
	7: 'R2',
	8: 'Select',
	9: 'Start',
	10: 'L3',
	11: 'R3',
	12: 'D-Up',
	13: 'D-Down',
	14: 'D-Left',
	15: 'D-Right',
	16: 'Home',
};

/**
 * Human-readable axis names
 */
const AXIS_NAMES = {
	0: 'Left X',
	1: 'Left Y',
	2: 'Right X',
	3: 'Right Y',
};

/**
 * Gamepad Input Device
 * Wraps a gamecontroller.js gamepad instance
 */
export class GamepadInputDevice extends InputDevice {
	constructor(gamepad) {
		// Use gamepad index as ID (prefixed to avoid conflicts)
		// gamecontroller.js uses 'id' for the gamepad index
		const gamepadIndex = gamepad.id;
		const id = `gamepad-${gamepadIndex}`;
		
		// Get the native gamepad name from the browser and make it friendly
		const nativeGamepads = navigator.getGamepads ? navigator.getGamepads() : [];
		const nativeGamepad = nativeGamepads[gamepadIndex];
		const rawName = nativeGamepad?.id || '';
		const name = getFriendlyGamepadName(rawName);
		
		super(id, name, 'gamepad');
		
		this.gamepad = gamepad;
		this.gamepadIndex = gamepadIndex;
		this.rawName = rawName;
		this.brand = detectGamepadBrand(rawName);
		
		// Track axis deadzone (to filter noise)
		this.axisDeadzone = 0.1;
		
		// Track last axis values to avoid spamming events
		this.lastAxisValues = new Map();
	}

	/**
	 * Get the friendly name for a button based on gamepad brand
	 * @param {number} button - Button index
	 * @returns {string} Friendly button name
	 */
	getButtonName(button) {
		// Face buttons (0-3) have brand-specific names
		if (button >= 0 && button <= 3) {
			return FACE_BUTTON_NAMES[this.brand]?.[button] || FACE_BUTTON_NAMES.xbox[button];
		}
		// Other buttons use common names
		return COMMON_BUTTON_NAMES[button] || `Button ${button}`;
	}

	/**
	 * Handle button down event
	 * @param {number} button - Button index
	 * @param {string} buttonName - Button name from gamecontroller.js
	 */
	handleButtonDown(button, buttonName) {
		const controlId = `button-${button}`;
		const friendlyName = this.getButtonName(button);
		
		this._emit('trigger', {
			controlId,
			velocity: 127,
			type: 'button',
			colorSupport: 'none', // Standard gamepads don't have per-button LEDs
			friendlyName,
			deviceBrand: this.brand,
		});
	}

	/**
	 * Handle button up event
	 * @param {number} button - Button index
	 */
	handleButtonUp(button) {
		const controlId = `button-${button}`;
		this._emit('release', { controlId });
	}

	/**
	 * Handle axis movement
	 * @param {number} axis - Axis index
	 * @param {string} axeName - Axis name from gamecontroller.js
	 * @param {number} value - Axis value (-1 to 1)
	 */
	handleAxisMove(axis, axeName, value) {
		const controlId = `axis-${axis}`;
		const friendlyName = AXIS_NAMES[axis] || `Axis ${axis}`;
		// Even axes (0, 2) are X (horizontal), odd axes (1, 3) are Y (vertical)
		const orientation = (axis % 2 === 0) ? 'horizontal' : 'vertical';
		
		// Apply deadzone
		let processedValue = value;
		if (Math.abs(value) < this.axisDeadzone) {
			processedValue = 0;
		}
		
		// Check if value has changed significantly
		const lastValue = this.lastAxisValues.get(axis) || 0;
		if (Math.abs(processedValue - lastValue) < 0.01) {
			return; // Skip tiny changes
		}
		this.lastAxisValues.set(axis, processedValue);
		
		// Normalize from -1..1 to 0..1
		const normalizedValue = (processedValue + 1) / 2;
		
		if (!this.controls.has(controlId)) {
			this.controls.set(controlId, { type: 'value', value: 0, min: -1, max: 1, orientation });
		}
		
		const control = this.controls.get(controlId);
		control.value = normalizedValue;
		
		this._emit('change', {
			controlId,
			value: normalizedValue,
			rawValue: processedValue,
			control,
			type: 'axis',
			orientation,
			colorSupport: 'none',
			friendlyName,
		});
	}

	/**
	 * Get all available controls for this gamepad
	 * @returns {Array} Array of control definitions
	 */
	getAvailableControls() {
		const controls = [];
		
		// Add buttons
		GAMEPAD_BUTTONS.forEach((buttonName, index) => {
			controls.push({
				controlId: `button-${index}`,
				type: 'button',
				friendlyName: this.getButtonName(index),
			});
		});
		
		// Add axes
		GAMEPAD_AXES.forEach((axeName, index) => {
			controls.push({
				controlId: `axis-${index}`,
				type: 'axis',
				friendlyName: AXIS_NAMES[index] || `Axis ${index}`,
			});
		});
		
		return controls;
	}

	/**
	 * Set axis deadzone
	 * @param {number} deadzone - Deadzone value (0 to 1)
	 */
	setDeadzone(deadzone) {
		this.axisDeadzone = Math.max(0, Math.min(1, deadzone));
	}

	disconnect() {
		// Gamepads disconnect automatically when unplugged
		// No explicit disconnect action needed
	}
}
